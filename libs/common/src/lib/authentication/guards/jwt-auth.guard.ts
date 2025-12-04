import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TokenService } from '../../token/token.service';
import { TokenSessionService } from '../../token/token-session.service';
import { AUTH_EXCEPTIONS, throwException } from '../../exceptions';
import { ExampleConfigService } from '../../config';

/**
 * JWT 인증 가드
 *
 * HttpOnly 쿠키에서 accessToken을 추출하고 검증합니다.
 * Access Token이 만료된 경우 Refresh Token을 사용하여 자동으로 갱신합니다.
 * 검증 성공 시 request.user에 UserDto를 첨부합니다.
 *
 * @example
 * ```typescript
 * @Get('me')
 * @UseGuards(JwtAuthGuard)
 * async getMe(@CurrentUser() user: UserDto) {
 *   return user;
 * }
 * ```
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private logger = new Logger(JwtAuthGuard.name, { timestamp: true });

  constructor(
    private readonly tokenService: TokenService,
    private readonly tokenSessionService: TokenSessionService,
    private readonly configService: ExampleConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // 1. 쿠키에서 accessToken과 refreshToken 추출
    const accessToken = request.cookies?.accessToken;
    const refreshToken = request.cookies?.refreshToken;

    // 2. Access Token이 있으면 검증 시도
    if (accessToken) {
      try {
        const payload = this.tokenService.verifyAccessToken(accessToken);

        // 세션 유효성 확인
        if (payload.jti) {
          const hasSession = await this.tokenSessionService.hasSession(
            payload.sub,
            payload.jti
          );
          if (!hasSession) {
            this.logger.warn('Session expired or invalid, attempting refresh');
          } else {
            request.user = this.tokenService.payloadToUser(payload);
            return true;
          }
        } else {
          // 구형 토큰 (jti 없음) - refresh 시도
          this.logger.warn(
            'Token without session ID (jti), attempting refresh'
          );
        }
      } catch (error) {
        // Access Token이 유효하지 않거나 만료됨 -> Refresh 시도
        this.logger.warn('Access token invalid or expired, attempting refresh');
      }
    } else {
      this.logger.warn('Access token not found, attempting refresh');
    }

    // 3. Access Token이 없거나 유효하지 않은 경우 Refresh Token으로 갱신 시도
    if (!refreshToken) {
      this.logger.error('Refresh token not found');
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.TOKEN_NOT_FOUND);
    }

    try {
      // 4. Refresh Token으로 새 토큰 발급
      const tokens = await this.tokenSessionService.refreshTokenPair(
        refreshToken
      );

      // 5. 새로운 토큰을 쿠키에 설정
      response.cookie(
        'accessToken',
        tokens.accessToken,
        this.configService.accessTokenCookieOptions
      );
      response.cookie(
        'refreshToken',
        tokens.refreshToken,
        this.configService.refreshTokenCookieOptions
      );

      // 6. 새 Access Token 검증 후 request.user에 첨부
      const newPayload = this.tokenService.verifyAccessToken(
        tokens.accessToken
      );
      request.user = this.tokenService.payloadToUser(newPayload);

      this.logger.log('Token refreshed successfully');
      return true;
    } catch (refreshError) {
      this.logger.error('Token refresh failed', refreshError);
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.TOKEN_INVALID);
    }
  }
}

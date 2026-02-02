import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from '../../token/token.service';
import { TokenSessionService } from '../../token/token-session.service';
import { AUTH_EXCEPTIONS, throwException } from '../../exceptions';

/**
 * JWT 인증 가드 (순수 인증만 담당)
 *
 * 토큰 추출 우선순위:
 * 1. Authorization: Bearer <token> 헤더 (모바일)
 * 2. HttpOnly 쿠키 (웹)
 *
 * 검증 성공 시 request.user에 UserDto를 첨부합니다.
 * 실패 시 정확한 에러를 그대로 던집니다:
 * - 토큰 없음 → TOKEN_NOT_FOUND
 * - 토큰 만료 → TOKEN_EXPIRED
 * - 토큰 변조 → TOKEN_INVALID
 * - 세션 없음 → SESSION_INVALID
 *
 * 웹 자동 갱신은 TokenRefreshMiddleware에서 Guard 실행 전에 처리합니다.
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
    private readonly tokenSessionService: TokenSessionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. 토큰 추출: Authorization 헤더 우선, 없으면 쿠키에서 추출
    const accessToken =
      this.extractBearerToken(request) ?? request.cookies?.accessToken;

    if (!accessToken) {
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.TOKEN_NOT_FOUND);
    }

    // 2. 토큰 검증 (TOKEN_EXPIRED / TOKEN_INVALID 그대로 throw)
    const payload = this.tokenService.verifyAccessToken(accessToken);

    // 3. 세션 유효성 확인
    if (!payload.jti) {
      this.logger.warn('Token without session ID (jti)');
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.SESSION_INVALID);
    }

    const hasSession = await this.tokenSessionService.hasSession(
      payload.sub,
      payload.jti
    );

    if (!hasSession) {
      this.logger.warn(
        `Session not found for user: ${payload.sub}, session: ${payload.jti}`
      );
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.SESSION_INVALID);
    }

    // 4. 인증 성공
    request.user = this.tokenService.payloadToUser(payload);
    return true;
  }

  /**
   * Authorization 헤더에서 Bearer 토큰을 추출합니다.
   * @returns Bearer 토큰 문자열 또는 null
   */
  private extractBearerToken(request: Request): string | null {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }
    return authorization.slice(7);
  }
}

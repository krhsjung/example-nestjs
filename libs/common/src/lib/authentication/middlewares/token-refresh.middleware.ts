import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../token/token.service';
import { TokenSessionService } from '../../token/token-session.service';
import { ExampleConfigService } from '../../config';

/**
 * 웹(쿠키) 요청의 Access Token 자동 갱신 미들웨어
 *
 * Guard 실행 전에 Access Token 만료 여부를 확인합니다.
 * 만료된 경우 Cookie의 Refresh Token으로 새 토큰을 발급하고
 * 쿠키를 갱신하여 Guard가 새 토큰으로 인증하도록 합니다.
 *
 * - Bearer 요청(모바일): 갱신하지 않고 그대로 통과
 * - Cookie 요청(웹): 만료 시 자동 갱신 후 Guard 통과
 *
 * @example AppModule에서 설정:
 * ```typescript
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(TokenRefreshMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 */
@Injectable()
export class TokenRefreshMiddleware implements NestMiddleware {
  private logger = new Logger(TokenRefreshMiddleware.name, {
    timestamp: true,
  });

  constructor(
    private readonly tokenService: TokenService,
    private readonly tokenSessionService: TokenSessionService,
    private readonly configService: ExampleConfigService
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Bearer 요청(모바일)이면 갱신 시도하지 않음
    if (req.headers.authorization?.startsWith('Bearer ')) {
      return next();
    }

    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;

    // Access Token이 없거나 Refresh Token이 없으면 Guard에 위임
    if (!accessToken || !refreshToken) {
      return next();
    }

    // Access Token이 유효한지 확인
    try {
      this.tokenService.verifyAccessToken(accessToken);
      // 유효하면 그대로 통과
      return next();
    } catch (error) {
      // TOKEN_EXPIRED가 아닌 에러(변조 등)는 Guard에 위임
      if (!this.isTokenExpiredError(error)) {
        return next();
      }
    }

    // Access Token 만료 → Refresh Token으로 갱신 시도
    try {
      const tokens =
        await this.tokenSessionService.refreshTokenPair(refreshToken);

      // 새 토큰을 쿠키에 설정
      res.cookie(
        'accessToken',
        tokens.accessToken,
        this.configService.accessTokenCookieOptions
      );
      res.cookie(
        'refreshToken',
        tokens.refreshToken,
        this.configService.refreshTokenCookieOptions
      );

      // 요청의 쿠키를 갱신하여 Guard가 새 토큰으로 인증하도록 함
      req.cookies.accessToken = tokens.accessToken;
      req.cookies.refreshToken = tokens.refreshToken;

      this.logger.log('Token refreshed successfully via middleware');
    } catch (refreshError) {
      // 갱신 실패 → Guard에 위임 (만료된 토큰으로 TOKEN_EXPIRED 에러 발생)
      this.logger.warn('Token refresh failed in middleware');
    }

    next();
  }

  /**
   * TokenExpiredError인지 확인
   * TokenService.verifyAccessToken에서 throw하는 에러의 name으로 판별
   */
  private isTokenExpiredError(error: unknown): boolean {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      return true;
    }

    // throwException으로 래핑된 경우 JSON message에서 id로 판별
    if (error && typeof error === 'object' && 'getResponse' in error) {
      try {
        const response = (error as { getResponse: () => unknown }).getResponse();
        const message =
          typeof response === 'string'
            ? response
            : (response as { message?: string }).message;

        if (!message) return false;

        const parsed = JSON.parse(message);
        return parsed.id === 'server_auth_token_expired';
      } catch {
        return false;
      }
    }

    return false;
  }
}

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtTokenService } from '@example/utils';
import { UserDto } from '../dtos';
import { AUTH_EXCEPTIONS, throwException } from '../exceptions';
import { JwtPayload } from './types/jwt-payload.types';

/**
 * 토큰 도메인 서비스
 *
 * UserDto와 JwtPayload 간의 변환 등 도메인 로직을 담당합니다.
 * 순수한 JWT 처리는 utils의 JwtTokenService를 사용합니다.
 */
@Injectable()
export class TokenService {
  private logger = new Logger(TokenService.name, { timestamp: true });

  constructor(private readonly jwtTokenService: JwtTokenService<JwtPayload>) {}

  /**
   * Access Token 검증 (도메인 예외 처리 포함)
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwtTokenService.verifyAccessToken(token);
    } catch (error) {
      this.logger.error('Access token verification failed', error);
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.TOKEN_INVALID);
    }
  }

  /**
   * Refresh Token 검증 (도메인 예외 처리 포함)
   */
  verifyRefreshToken(token: string): JwtPayload {
    try {
      return this.jwtTokenService.verifyRefreshToken(token);
    } catch (error) {
      this.logger.error('Refresh token verification failed', error);
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.TOKEN_INVALID);
    }
  }

  /**
   * UserDto를 JwtPayload로 변환
   */
  userToPayload(user: UserDto, sessionId: string): JwtPayload {
    return {
      sub: user.id!,
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider: user.provider,
      maxSessions: user.maxSessions,
      jti: sessionId,
    };
  }

  /**
   * JwtPayload를 UserDto로 변환
   */
  payloadToUser(payload: JwtPayload): UserDto {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      provider: payload.provider,
      maxSessions: payload.maxSessions,
    };
  }
}

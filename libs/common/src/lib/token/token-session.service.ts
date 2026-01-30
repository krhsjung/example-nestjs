import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { RedisService, JwtTokenService, TokenPair } from '@example/utils';
import { UserDto } from '../dtos';
import { AUTH_EXCEPTIONS, throwException } from '../exceptions';
import { TokenService } from './token.service';
import { JwtPayload } from './types/jwt-payload.types';
import { randomUUID } from 'crypto';

/**
 * 토큰 세션 관리 서비스
 *
 * 사용자별 세션 관리, Refresh Token 저장/검증, Token Rotation을 담당합니다.
 * Redis를 사용하여 세션 정보와 Refresh Token을 저장합니다.
 */
@Injectable()
export class TokenSessionService {
  private readonly logger = new Logger(TokenSessionService.name, {
    timestamp: true,
  });
  private readonly SESSION_PREFIX = 'user_sessions:';
  private readonly REFRESH_TOKEN_PREFIX = 'refresh:';
  private readonly AUTH_CODE_PREFIX = 'auth_code:';
  private readonly AUTH_CODE_TTL = 10; // 10초

  constructor(
    private readonly redisService: RedisService,
    private readonly jwtTokenService: JwtTokenService<JwtPayload>,
    private readonly tokenService: TokenService
  ) {}

  /**
   * 사용자를 위한 새로운 세션 생성 (토큰 페어 포함)
   */
  async createSession(user: UserDto): Promise<TokenPair> {
    const sessionId = randomUUID();
    const maxSessions = user.maxSessions || 1;

    // JWT 페이로드 생성
    const payload = this.tokenService.userToPayload(user, sessionId);

    // 토큰 페어 생성
    const tokens = this.jwtTokenService.generateTokenPair(payload);

    // Refresh Token TTL 계산
    const ttl = this.jwtTokenService.getTokenTTL(tokens.refreshToken);

    // 세션 추가 (최대 세션 수 관리)
    await this.addSession(user.idx!, sessionId, ttl, maxSessions);

    // Refresh Token 저장
    await this.saveRefreshToken(user.idx!, sessionId, tokens.refreshToken);

    this.logger.log(
      `Created session for user: ${user.email} (${user.idx}) with session: ${sessionId} (max sessions: ${maxSessions})`
    );

    return tokens;
  }

  /**
   * 세션 추가 (최대 세션 수 초과 시 가장 오래된 세션 제거)
   */
  private async addSession(
    userId: number,
    sessionId: string,
    ttl: number,
    maxSessions: number = 1
  ): Promise<void> {
    const key = `${this.SESSION_PREFIX}${userId}`;
    const now = Date.now();

    // 현재 시간을 score로, sessionId를 member로 저장
    await this.redisService.raw.zadd(key, now, sessionId);

    // 세션 수 확인
    const sessionCount = await this.redisService.raw.zcard(key);

    if (sessionCount > maxSessions) {
      // 가장 오래된 세션 제거 (score가 가장 낮은 것)
      const removed = await this.redisService.raw.zpopmin(
        key,
        sessionCount - maxSessions
      );
      this.logger.log(
        `Removed ${
          sessionCount - maxSessions
        } old session(s) for user: ${userId}`
      );

      // 제거된 세션들의 Refresh Token도 Redis에서 삭제
      if (Array.isArray(removed) && removed.length > 0) {
        for (let i = 0; i < removed.length; i += 2) {
          const oldSessionId = removed[i];
          await this.redisService.del(
            `${this.REFRESH_TOKEN_PREFIX}${userId}:${oldSessionId}`
          );
        }
      }
    }

    // TTL 설정
    await this.redisService.raw.expire(key, ttl);
    this.logger.log(
      `Added session ${sessionId} for user: ${userId} (max: ${maxSessions})`
    );
  }

  /**
   * 세션 존재 여부 확인
   */
  async hasSession(userId: number, sessionId: string): Promise<boolean> {
    const key = `${this.SESSION_PREFIX}${userId}`;
    const score = await this.redisService.raw.zscore(key, sessionId);
    return score !== null;
  }

  /**
   * 세션 제거
   */
  async removeSession(userId: number, sessionId: string): Promise<void> {
    const key = `${this.SESSION_PREFIX}${userId}`;
    await this.redisService.raw.zrem(key, sessionId);
    await this.deleteRefreshToken(userId, sessionId);
    this.logger.log(`Removed session ${sessionId} for user: ${userId}`);
  }

  /**
   * 사용자의 모든 세션 제거
   */
  async removeAllSessions(userId: number): Promise<void> {
    // 모든 세션 ID 조회
    const sessionIds = await this.getAllSessions(userId);

    // 각 세션의 Refresh Token 삭제
    for (const sessionId of sessionIds) {
      await this.deleteRefreshToken(userId, sessionId);
    }

    // 세션 목록 삭제
    const key = `${this.SESSION_PREFIX}${userId}`;
    await this.redisService.del(key);
    this.logger.log(`Removed all sessions for user: ${userId}`);
  }

  /**
   * 사용자의 활성 세션 수 조회
   */
  async getSessionCount(userId: number): Promise<number> {
    const key = `${this.SESSION_PREFIX}${userId}`;
    return await this.redisService.raw.zcard(key);
  }

  /**
   * 사용자의 모든 세션 ID 조회
   */
  async getAllSessions(userId: number): Promise<string[]> {
    const key = `${this.SESSION_PREFIX}${userId}`;
    // ZREVRANGE: score가 높은 순(최신 순)으로 반환
    return await this.redisService.raw.zrevrange(key, 0, -1);
  }

  /**
   * 세션 활동 시간 업데이트
   */
  async updateSessionActivity(
    userId: number,
    sessionId: string
  ): Promise<void> {
    const key = `${this.SESSION_PREFIX}${userId}`;
    const now = Date.now();

    // score(timestamp)를 현재 시간으로 업데이트
    await this.redisService.raw.zadd(key, now, sessionId);
  }

  /**
   * maxSessions 변경 시 기존 세션을 새로운 제한에 맞게 정리
   */
  async enforceMaxSessions(
    userId: number,
    newMaxSessions: number
  ): Promise<void> {
    const key = `${this.SESSION_PREFIX}${userId}`;
    const sessionCount = await this.redisService.raw.zcard(key);
    this.logger.log(
      `[enforceMaxSessions] Current sessions: ${sessionCount}, New maxSessions: ${newMaxSessions} for user: ${userId}`
    );
    if (sessionCount > newMaxSessions) {
      // 가장 오래된 세션들을 제거
      const toRemove = sessionCount - newMaxSessions;
      const removed = await this.redisService.raw.zpopmin(key, toRemove);
      this.logger.log(
        `[enforceMaxSessions] Removed ${toRemove} old session(s) for user: ${userId} (new limit: ${newMaxSessions})`
      );

      // 제거된 세션들의 Refresh Token도 삭제
      if (Array.isArray(removed) && removed.length > 0) {
        for (let i = 0; i < removed.length; i += 2) {
          const oldSessionId = removed[i];
          await this.deleteRefreshToken(userId, oldSessionId);
        }
      }
    }
  }

  /**
   * Refresh Token을 Redis에 저장
   */
  private async saveRefreshToken(
    userId: number,
    sessionId: string,
    token: string
  ): Promise<void> {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}:${sessionId}`;
    const ttl = this.jwtTokenService.getTokenTTL(token);

    await this.redisService.set(key, token, ttl);
    this.logger.log(
      `Saved refresh token for user: ${userId}, session: ${sessionId} with TTL: ${ttl}s`
    );
  }

  /**
   * Redis에서 Refresh Token 조회
   */
  private async getRefreshToken(
    userId: number,
    sessionId: string
  ): Promise<string | null> {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}:${sessionId}`;
    return await this.redisService.get(key);
  }

  /**
   * Refresh Token 삭제
   */
  private async deleteRefreshToken(
    userId: number,
    sessionId: string
  ): Promise<void> {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}:${sessionId}`;
    await this.redisService.del(key);
  }

  /**
   * 모바일 OAuth용 일회용 인증 코드 생성
   * UserDto를 Redis에 저장하고 authCode 반환
   */
  async createAuthCode(user: UserDto): Promise<string> {
    const authCode = randomUUID();
    const key = `${this.AUTH_CODE_PREFIX}${authCode}`;

    await this.redisService.set(key, JSON.stringify(user), this.AUTH_CODE_TTL);

    this.logger.log(
      `Created auth code: ${authCode} for user: ${user.email} (TTL: ${this.AUTH_CODE_TTL}s)`
    );
    return authCode;
  }

  /**
   * 인증 코드로 세션 생성 (일회용 - 조회 후 삭제)
   */
  async exchangeAuthCode(authCode: string): Promise<TokenPair | null> {
    const key = `${this.AUTH_CODE_PREFIX}${authCode}`;
    const data = await this.redisService.get(key);

    if (!data) {
      this.logger.warn(`Auth code not found or expired: ${authCode}`);
      return null;
    }

    // 일회용이므로 즉시 삭제
    await this.redisService.del(key);

    const user = JSON.parse(data) as UserDto;
    this.logger.log(`Exchanged auth code: ${authCode} for user: ${user.email}`);

    return this.createSession(user);
  }

  /**
   * Refresh Token으로 새 Token Pair 발급 (Refresh Token Rotation)
   */
  async refreshTokenPair(refreshToken: string): Promise<TokenPair> {
    const methodName = 'refreshTokenPair';

    // 1. Refresh Token 검증
    const payload = this.tokenService.verifyRefreshToken(refreshToken);

    if (!payload.jti) {
      this.logger.error(
        `[${methodName}] Refresh token missing session ID (jti)`
      );
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.TOKEN_INVALID);
    }

    // 2. 세션 유효성 확인
    const hasSession = await this.hasSession(payload.sub, payload.jti);
    if (!hasSession) {
      this.logger.error(
        `[${methodName}] Session not found or expired for user: ${payload.sub}, session: ${payload.jti}`
      );
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.TOKEN_INVALID);
    }

    // 3. Redis에 저장된 Refresh Token과 비교
    const storedToken = await this.getRefreshToken(payload.sub, payload.jti);
    if (!storedToken || storedToken !== refreshToken) {
      this.logger.error(
        `[${methodName}] Refresh token mismatch for user: ${payload.sub}, session: ${payload.jti}`
      );
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.TOKEN_INVALID);
    }

    // 4. 새로운 토큰 페어 생성 (같은 세션 ID 유지)
    const newPayload: JwtPayload = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      provider: payload.provider,
      jti: payload.jti,
    };

    const tokens = this.jwtTokenService.generateTokenPair(newPayload);

    // 5. 새로운 Refresh Token 저장 (기존 토큰 덮어쓰기)
    await this.saveRefreshToken(payload.sub, payload.jti, tokens.refreshToken);

    // 6. 세션 활동 시간 업데이트
    await this.updateSessionActivity(payload.sub, payload.jti);

    this.logger.log(
      `[${methodName}] Refreshed token pair for user: ${payload.email}, session: ${payload.jti}`
    );

    return tokens;
  }
}

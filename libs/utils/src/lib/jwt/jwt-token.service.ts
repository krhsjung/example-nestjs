import { Injectable, Logger } from '@nestjs/common';
import { JwtConfig, TokenPair } from './jwt.types';
import * as jwt from 'jsonwebtoken';

/**
 * JWT 페이로드의 기본 인터페이스
 * exp, iat는 jwt 라이브러리가 자동으로 추가
 */
export interface BaseJwtPayload {
  exp?: number;
  iat?: number;
}

/**
 * 순수한 JWT 토큰 유틸리티 서비스 (제네릭)
 *
 * 도메인 로직 없이 JWT 토큰의 생성, 검증, 디코딩만 담당합니다.
 * 설정값을 생성자에서 주입받아 사용합니다.
 *
 * @template T - JWT 페이로드 타입 (BaseJwtPayload를 확장해야 함)
 */
@Injectable()
export class JwtTokenService<T extends BaseJwtPayload = BaseJwtPayload> {
  private logger = new Logger(JwtTokenService.name, { timestamp: true });
  private config: JwtConfig;

  constructor(config: JwtConfig) {
    this.config = config;
  }

  /**
   * Access Token 생성
   */
  generateAccessToken(payload: T): string {
    return jwt.sign(payload as object, this.config.accessTokenSecret, {
      expiresIn: this.config.accessTokenExpiresIn,
    });
  }

  /**
   * Refresh Token 생성
   */
  generateRefreshToken(payload: T): string {
    return jwt.sign(payload as object, this.config.refreshTokenSecret, {
      expiresIn: this.config.refreshTokenExpiresIn,
    });
  }

  /**
   * Access Token과 Refresh Token 생성
   */
  generateTokenPair(payload: T): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return { accessToken, refreshToken };
  }

  /**
   * Access Token 검증
   */
  verifyAccessToken(token: string): T {
    try {
      const payload = jwt.verify(
        token,
        this.config.accessTokenSecret
      ) as T;
      return payload;
    } catch (error) {
      this.logger.error('Access token verification failed', error);
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Refresh Token 검증
   */
  verifyRefreshToken(token: string): T {
    try {
      const payload = jwt.verify(
        token,
        this.config.refreshTokenSecret
      ) as T;
      return payload;
    } catch (error) {
      this.logger.error('Refresh token verification failed', error);
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * JWT 토큰 디코딩 (검증 없이)
   */
  decodeToken(token: string): T | null {
    return jwt.decode(token) as T | null;
  }

  /**
   * 토큰의 만료 시간(TTL) 계산
   */
  getTokenTTL(token: string): number {
    const decoded = this.decodeToken(token);
    if (!decoded?.exp) {
      throw new Error('Invalid token: missing expiration');
    }

    const now = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - now;

    if (ttl <= 0) {
      throw new Error('Token is already expired');
    }

    return ttl;
  }
}

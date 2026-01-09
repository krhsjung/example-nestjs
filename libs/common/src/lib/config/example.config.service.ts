import {
  AppleAuthClientOptions,
  GoogleAuthClientOptions,
  RedisMode,
} from '@example/utils';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';
import { RedisOptions } from 'ioredis';
import { PostgresConnectionCredentialsOptions } from 'typeorm/driver/postgres/PostgresConnectionCredentialsOptions';
import ms, { type StringValue } from 'ms';

interface PostgresConfig {
  master: PostgresConnectionCredentialsOptions;
  slaves: PostgresConnectionCredentialsOptions[];
}

@Injectable()
export class ExampleConfigService extends ConfigService {
  get isDevelopment(): boolean {
    return (
      process.env['NODE_ENV'] === 'development' ||
      process.env['NODE_ENV'] === 'local'
    );
  }

  get domain(): string {
    return this.get<string>('SERVICE_DOMAIN') || '';
  }

  get domainUrl(): string {
    return `https://${this.domain}`;
  }

  get globalPrefix(): string {
    const env = process.env['NODE_ENV'] || 'local';
    return `example/nestjs/${env}/api`;
  }

  get postgresConfig(): PostgresConfig {
    return {
      master: {
        host: this.get<string>('POSTGRES_PRIMARY_HOST') ?? 'localhost',
        port: this.get<number>('POSTGRES_PRIMARY_PORT') ?? 5432,
        username: this.get<string>('POSTGRES_USER') ?? 'example_nestjs',
        password: this.get<string>('POSTGRES_PASSWORD') ?? '',
        database: this.get<string>('POSTGRES_DATABASE_NAME') ?? 'example',
      },
      slaves: [
        {
          host: this.get<string>('POSTGRES_STANDBY_HOST') ?? 'localhost',
          port: this.get<number>('POSTGRES_STANDBY_PORT') ?? 5433,
          username: this.get<string>('POSTGRES_USER') ?? 'example_nestjs',
          password: this.get<string>('POSTGRES_PASSWORD') ?? '',
          database: this.get<string>('POSTGRES_DATABASE_NAME') ?? 'example',
        },
      ],
    };
  }

  get redisMode(): RedisMode {
    return this.get<RedisMode>('REDIS_MODE') || 'single';
  }

  get redisSingleConfig(): RedisOptions {
    return {
      host: this.get<string>('REDIS_HOST', 'localhost'),
      port: this.get<number>('REDIS_PORT', 6379),
      username: this.get<string>('REDIS_USERNAME', 'default'),
      password: this.get<string>('REDIS_PASSWORD', ''),
      db: this.get<number>('REDIS_DB_INDEX', 0),
    };
  }

  private providerReddirectUri(provider: string): string {
    return `https://${this.domain}/${this.globalPrefix}/auth/${provider}/callback`;
  }

  // Google OAuth 설정
  get googleClientId(): string {
    return this.get<string>('EXAMPLE_GOOGLE_CLIENT_ID') || '';
  }

  get googleClientSecret(): string {
    return this.get<string>('EXAMPLE_GOOGLE_CLIENT_SECRET') || '';
  }

  get googleRedirectUri(): string {
    return this.providerReddirectUri('google');
  }

  get googleClientOptions(): GoogleAuthClientOptions {
    return {
      googleClientId: this.googleClientId,
      googleClientSecret: this.googleClientSecret,
      googleRedirectUri: this.googleRedirectUri,
    };
  }

  // Apple OAuth 설정
  get appleTeamId(): string {
    return this.get<string>('EXAMPLE_APPLE_TEAM_ID') || '';
  }

  get appleClientId(): string {
    return this.get<string>('EXAMPLE_APPLE_CLIENT_ID') || '';
  }

  get appleBundleId(): string {
    return this.get<string>('EXAMPLE_APPLE_BUNDLE_ID') || '';
  }

  get appleKeyId(): string {
    return this.get<string>('EXAMPLE_APPLE_KEY_ID') || '';
  }

  get applePrivateKey(): string {
    return this.get<string>('EXAMPLE_APPLE_PRIVATE_KEY') || '';
  }

  get appleRedirectUri(): string {
    return this.providerReddirectUri('apple');
  }

  get appleClientOptions(): AppleAuthClientOptions {
    return {
      appleTeamId: this.appleTeamId,
      appleClientId: this.appleClientId,
      appleBundleId: this.appleBundleId || undefined,
      appleKeyId: this.appleKeyId,
      applePrivateKey: this.applePrivateKey,
      appleRedirectUri: this.appleRedirectUri,
    };
  }

  // JWT 설정
  get jwtSecret(): string {
    return this.get<string>('JWT_SECRET_KEY') || 'default-jwt-secret-key';
  }

  get jwtRefreshSecret(): string {
    return (
      this.get<string>('JWT_REFRESH_SECRET_KEY') ||
      'default-jwt-refresh-secret-key'
    );
  }

  get accessTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: !this.isDevelopment, // 개발 환경에서는 false로 설정하여 브라우저에서 확인 가능
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: ms(this.jwtAccessTokenExpiresIn),
    };
  }

  get refreshTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: !this.isDevelopment,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: ms(this.jwtRefreshTokenExpiresIn),
    };
  }

  get jwtAccessTokenExpiresIn(): StringValue {
    return this.get<StringValue>('JWT_ACCESS_TOKEN_EXPIRES_IN') || '900s';
  }

  get jwtRefreshTokenExpiresIn(): StringValue {
    return this.get<StringValue>('JWT_REFRESH_TOKEN_EXPIRES_IN') || '7d';
  }

  // Mobile App URL Scheme
  get appUrlScheme(): string {
    return this.get<string>('APP_URL_SCHEME') || 'example';
  }

  get appOAuthCallbackUrl(): string {
    return `${this.appUrlScheme}://oauth/callback`;
  }
}

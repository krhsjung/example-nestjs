import {
  AppleAuthClientOptions,
  GoogleAuthClientOptions,
  RedisMode,
} from '@example/utils';
import { Injectable, OnModuleInit } from '@nestjs/common';
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
export class ExampleConfigService
  extends ConfigService
  implements OnModuleInit
{
  onModuleInit() {
    if (!this.isDevelopment) {
      this.validateRequiredEnvVars([
        'JWT_SECRET_KEY',
        'JWT_REFRESH_SECRET_KEY',
        'COTURN_TURN_SECRET',
      ]);
    }
  }

  private validateRequiredEnvVars(keys: string[]): void {
    const missing = keys.filter((key) => !this.get<string>(key));
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }
  get isLocal(): boolean {
    return process.env['NODE_ENV'] === 'local';
  }

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

  private providerRedirectUri(provider: string): string {
    return `https://${this.domain}/${this.globalPrefix}/auth/${provider}/callback`;
  }

  // Google OAuth 설정
  get googleClientId(): string {
    return this.getOrThrow<string>('EXAMPLE_GOOGLE_CLIENT_ID');
  }

  get googleClientSecret(): string {
    return this.getOrThrow<string>('EXAMPLE_GOOGLE_CLIENT_SECRET');
  }

  get googleRedirectUri(): string {
    return this.providerRedirectUri('google');
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
    return this.getOrThrow<string>('EXAMPLE_APPLE_TEAM_ID');
  }

  get appleClientId(): string {
    return this.getOrThrow<string>('EXAMPLE_APPLE_CLIENT_ID');
  }

  get appleBundleId(): string {
    return this.getOrThrow<string>('EXAMPLE_APPLE_BUNDLE_ID');
  }

  get appleKeyId(): string {
    return this.getOrThrow<string>('EXAMPLE_APPLE_KEY_ID');
  }

  get applePrivateKey(): string {
    return this.getOrThrow<string>('EXAMPLE_APPLE_PRIVATE_KEY');
  }

  get appleRedirectUri(): string {
    return this.providerRedirectUri('apple');
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
    return this.getOrThrow<string>('JWT_SECRET_KEY');
  }

  get jwtRefreshSecret(): string {
    return this.getOrThrow<string>('JWT_REFRESH_SECRET_KEY');
  }

  get accessTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: !this.isLocal, // 개발 환경에서는 false로 설정하여 브라우저에서 확인 가능
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: ms(this.jwtAccessTokenExpiresIn),
    };
  }

  get refreshTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: !this.isLocal,
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

  get androidPackageName(): string {
    return this.get<string>('EXAMPLE_ANDROID_PACKAGE_NAME') || '';
  }

  get androidSha256Fingerprint(): string {
    return this.get<string>('EXAMPLE_ANDROID_SHA256_FINGERPRINT') || '';
  }

  get appStoreUrl(): string {
    return this.get<string>('EXAMPLE_APP_STORE_URL') || '';
  }

  get playStoreUrl(): string {
    return this.get<string>('EXAMPLE_PLAY_STORE_URL') || '';
  }

  // TURN Server
  get coturnTurnSecret(): string {
    return this.getOrThrow<string>('COTURN_TURN_SECRET');
  }
}

import { GoogleAuthCileOptions, RedisMode } from '@example/utils';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';
import { RedisOptions } from 'ioredis';
import { PostgresConnectionCredentialsOptions } from 'typeorm/driver/postgres/PostgresConnectionCredentialsOptions';

interface PostgresConfig {
  master: PostgresConnectionCredentialsOptions;
  slaves: PostgresConnectionCredentialsOptions[];
}

@Injectable()
export class ExampleConfigService extends ConfigService {
  get isDevelopment(): boolean {
    return (
      this.get<string>('NODE_ENV') === 'development' ||
      this.get<string>('NODE_ENV') === 'local'
    );
  }

  get domain(): string {
    return this.get<string>('SERVICE_DOMAIN') || '';
  }

  get domainUrl(): string {
    return `https://${this.domain}`;
  }

  get globalPrefix(): string {
    const env = this.get<string>('NODE_ENV') || 'local';
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
      username: this.get<string>('REDIS_USERNAME', 'default'),
      host: this.get<string>('REDIS_HOST', 'localhost'),
      port: this.get<number>('REDIS_PORT', 6379),
      password: this.get<string>('REDIS_PASSWORD', ''),
      db: this.get<number>('REDIS_DB', 0),
    };
  }

  get cookieOptions(): CookieOptions {
    return {
      httpOnly: !this.isDevelopment, // 개발 환경에서는 false로 설정하여 브라우저에서 확인 가능
      secure: true, // HTTPS를 사용하므로 true
      sameSite: 'none', // 크로스 도메인이므로 'none' 필요
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  get googleClientId(): string {
    return this.get<string>('EXAMPLE_GOOGLE_CLIENT_ID') || '';
  }

  get googleClientSecret(): string {
    return this.get<string>('EXAMPLE_GOOGLE_CLIENT_SECRET') || '';
  }

  get googleRedirectUri(): string {
    return `https://${this.domain}/${this.globalPrefix}/auth/google/callback`;
  }

  get googleClientOptions(): GoogleAuthCileOptions {
    return {
      googleClientId: this.googleClientId,
      googleClientSecret: this.googleClientSecret,
      googleRedirectUri: this.googleRedirectUri,
    };
  }
}

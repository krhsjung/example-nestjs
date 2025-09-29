import { RedisMode } from '@example/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  get redisSingleConfig() {
    return {
      host: this.get<string>('REDIS_HOST', 'localhost'),
      port: this.get<number>('REDIS_PORT', 6379),
      password: this.get<string | null>('REDIS_PASSWORD', null),
      db: this.get<number>('REDIS_DB', 0),
      tls: this.get<string>('REDIS_TLS', 'false') === 'true',
    };
  }
}

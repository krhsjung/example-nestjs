import {
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import {
  ExampleConfigModule,
  ExampleConfigService,
  PostgresModule,
  UserSubscriber,
  TokenModule,
  TokenSessionService,
  TokenRefreshMiddleware,
} from '@example/common';
import { RedisModule } from '@example/utils';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    ExampleConfigModule,
    // Rate Limiting: 기본값 (전체 API에 적용되지 않고, @Throttle() 데코레이터를 사용한 엔드포인트에만 적용)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1분
        limit: 5, // 5회
      },
      {
        name: 'long',
        ttl: 3600000, // 1시간
        limit: 100, // 100회
      },
    ]),
    UserModule,
    AuthModule,
    HealthModule,
    PostgresModule.forRootAsync(),
    RedisModule.registerAsync({
      isGlobal: true,
      imports: [ExampleConfigModule],
      inject: [ExampleConfigService],
      useFactory: (configService: ExampleConfigService) => {
        const mode = configService.redisMode;

        // Currently, only 'single' mode is implemented.
        if (mode !== 'single') {
          throw new Error(`Unsupported Redis mode: ${mode}`);
        }

        // default: single
        return {
          mode: 'single',
          option: configService.redisSingleConfig,
        };
      },
    }),
    TokenModule,
  ],
  controllers: [],
  providers: [UserSubscriber, TokenRefreshMiddleware],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tokenSessionService: TokenSessionService,
    private readonly userSubscriber: UserSubscriber
  ) {}

  private readonly logger = new Logger(AppModule.name, { timestamp: true });

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TokenRefreshMiddleware).forRoutes('*');
  }

  async onModuleInit() {
    // UserSubscriber에 SessionService 주입
    this.userSubscriber.setSessionService(this.tokenSessionService);

    // DataSource의 subscribers에 UserSubscriber 등록
    // TypeORM이 NestJS가 생성한 인스턴스를 사용하도록 함
    if (!this.dataSource.subscribers.includes(this.userSubscriber)) {
      this.dataSource.subscribers.push(this.userSubscriber);
    }

    // 스키마 및 테이블이 없으면 생성
    await this.ensureSchema();
  }

  private async ensureSchema() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS example."user" (
        "idx"           SERIAL PRIMARY KEY,
        "sns_id"        VARCHAR UNIQUE,
        "provider"      VARCHAR NOT NULL,
        "password"      VARCHAR,
        "name"          VARCHAR NOT NULL,
        "email"         VARCHAR NOT NULL UNIQUE,
        "picture"       VARCHAR,
        "max_sessions"  INT NOT NULL DEFAULT 1,
        "updated_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.logger.log('Database schema verified');
  }
}

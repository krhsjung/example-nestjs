import { Module, OnModuleInit } from '@nestjs/common';
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
} from '@example/common';
import { RedisModule } from '@example/utils';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    ExampleConfigModule,
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
  providers: [UserSubscriber],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tokenSessionService: TokenSessionService,
    private readonly userSubscriber: UserSubscriber
  ) {}

  onModuleInit() {
    // UserSubscriber에 SessionService 주입
    this.userSubscriber.setSessionService(this.tokenSessionService);

    // DataSource의 subscribers에 UserSubscriber 등록
    // TypeORM이 NestJS가 생성한 인스턴스를 사용하도록 함
    if (!this.dataSource.subscribers.includes(this.userSubscriber)) {
      this.dataSource.subscribers.push(this.userSubscriber);
    }
  }
}

import { Module } from '@nestjs/common';
import {
  ExampleConfigModule,
  ExampleConfigService,
  PostgresModule,
  RedisModule,
} from '@example/common';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ExampleConfigModule,
    PostgresModule.forRootAsync(),
    UserModule,
    RedisModule.registerAsync({
      isGlobal: true,
      imports: [ExampleConfigModule],
      inject: [ExampleConfigService],
      useFactory: (configService: ExampleConfigService) => {
        const mode = configService.redisMode;
        console.log(`[AppModule] Redis mode: ${mode}`);

        // default: single
        return {
          mode: 'single',
          option: configService.redisSingleConfig,
        };
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

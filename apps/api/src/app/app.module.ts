import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import {
  ExampleConfigModule,
  ExampleConfigService,
  PostgresModule,
  RedisModule,
} from '@example/common';
import { UserModule } from './user/user.module';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

@Module({
  imports: [
    ExampleConfigModule,
    UserModule,
    PostgresModule.forRootAsync(),
    RedisModule.registerAsync({
      isGlobal: true,
      imports: [ExampleConfigModule],
      inject: [ExampleConfigService],
      useFactory: (configService: ExampleConfigService) => {
        const mode = configService.redisMode;
        console.log(`[AppModule] Redis mode: ${mode}`);

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
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ExampleConfigModule],
      inject: [ExampleConfigService],
      useFactory: async (configService: ExampleConfigService) => {
        const mode = configService.redisMode;
        console.log(`[AppModule] CacheModule Redis mode: ${mode}`);

        // Currently, only 'single' mode is implemented.
        if (mode !== 'single') {
          throw new Error(`Unsupported Redis mode for CacheModule: ${mode}`);
        }

        const redisConfig = configService.redisSingleConfig;
        const keyv = new Keyv({
          store: new KeyvRedis({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db || 0,
          }),
        });

        return {
          store: keyv,
          ttl: 300, // 5분 기본 TTL
        };
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

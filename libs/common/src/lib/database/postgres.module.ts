import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExampleConfigService } from '../config/example.config.service';
import { ExampleConfigModule } from '../config/example.config.module';

@Module({})
export class PostgresModule {
  static forRootAsync(): DynamicModule {
    return TypeOrmModule.forRootAsync({
      imports: [ExampleConfigModule],
      inject: [ExampleConfigService],
      useFactory: async (configService: ExampleConfigService) => ({
        type: 'postgres',
        replication: configService.postgresConfig,
        synchronize: false,
        logging: configService.isDevelopment,
        entities: [],
      }),
    });
  }
}

import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExampleConfigService } from './example.config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `./config/.env.${process.env['NODE_ENV'] || 'local'}`,
      expandVariables: true, // .env에서 ${VAR} 문법 확장
    }),
  ],
  providers: [
    // ① 실제 인스턴스를 만드는 프로바이더
    ExampleConfigService,
    // ② ConfigService 토큰에도 같은 인스턴스를 바인딩
    {
      provide: ConfigService,
      useExisting: ExampleConfigService,
    },
  ],
  exports: [ExampleConfigService],
})
export class ExampleConfigModule {}

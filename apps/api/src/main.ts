/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ExampleConfigService } from '@example/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ExampleConfigService);

  // Cookie parser 미들웨어 추가
  app.use(cookieParser());

  // CORS 설정 추가
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix(configService.globalPrefix);
  const port = process.env.EXCAMPLE_API_PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${configService.globalPrefix}`
  );
}

bootstrap();

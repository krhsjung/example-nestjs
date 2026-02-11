/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ExampleConfigService, GlobalExceptionFilter } from '@example/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ExampleConfigService);

  // 보안 헤더 미들웨어 (X-Content-Type-Options, X-Frame-Options 등)
  // - CSP 비활성화: API 서버라 HTML 응답이 OAuth 콜백 정도뿐
  // - COOP 비활성화: OAuth 팝업에서 window.opener 접근이 필요
  // - 개발 환경에서는 HSTS 비활성화 (localhost HTTP 접근 허용)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
      hsts: configService.isDevelopment ? false : undefined,
    })
  );

  // Cookie parser 미들웨어 추가 (JWT 토큰 쿠키 파싱)
  app.use(cookieParser());

  // CORS 설정 추가
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 글로벌 예외 필터 (HttpException이 아닌 에러의 내부 메시지 숨김)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 글로벌 DTO 유효성 검증 파이프
  // - whitelist: DTO에 정의되지 않은 속성을 자동으로 제거 (예: LoginDto에 없는 role 필드가 오면 무시)
  // - forbidNonWhitelisted: DTO에 정의되지 않은 속성이 있으면 400 Bad Request 반환
  //   (whitelist만 하면 조용히 제거하지만, 이 옵션은 클라이언트에게 잘못된 필드를 명시적으로 알려줌)
  // - transform: 요청 body의 plain object를 DTO 클래스 인스턴스로 자동 변환
  //   (class-validator 데코레이터가 동작하려면 필요)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.setGlobalPrefix(configService.globalPrefix);
  const port = process.env.EXAMPLE_API_PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${configService.globalPrefix}`
  );
}

bootstrap();

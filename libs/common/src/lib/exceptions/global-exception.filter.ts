import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { COMMON_EXCEPTIONS } from './constants/common.exceptions';

/**
 * 글로벌 예외 필터
 *
 * - HttpException: 정의된 응답 형식을 그대로 클라이언트에 전달
 * - 그 외 예외(Error, TypeError 등): 내부 에러 메시지를 숨기고
 *   일반적인 "Internal server error" 메시지만 반환
 *
 * 이를 통해 OAuth 클라이언트, JWT 라이브러리 등에서 발생하는
 * 상세 에러 메시지가 클라이언트에 노출되는 것을 방지합니다.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name, {
    timestamp: true,
  });

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      response
        .status(status)
        .json(
          typeof exceptionResponse === 'string'
            ? { statusCode: status, message: exceptionResponse }
            : exceptionResponse
        );
      return;
    }

    // HttpException이 아닌 예외: 내부 메시지를 숨기고 로그에만 기록
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : exception
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      id: COMMON_EXCEPTIONS.INTERNAL_SERVER_ERROR.id,
      message: COMMON_EXCEPTIONS.INTERNAL_SERVER_ERROR.message,
    });
  }
}

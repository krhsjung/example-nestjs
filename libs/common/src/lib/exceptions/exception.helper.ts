import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception message format for frontend i18n
 */
export interface ExceptionMessage {
  id: string;
  message: string;
}

/**
 * Helper function to throw HTTP exceptions with JSON message format
 *
 * @param exceptionClass - NestJS exception class (e.g., UnauthorizedException, NotFoundException)
 * @param exceptionMessage - Exception message object with id and message
 * @param params - Optional parameters to interpolate into the message (for dynamic values)
 *
 * @example
 * throwException(UnauthorizedException, AUTH_EXCEPTIONS.SESSION_NOT_FOUND);
 *
 * @example with params
 * throwException(
 *   NotFoundException,
 *   USER_EXCEPTIONS.NOT_FOUND,
 *   { id: '123' }
 * );
 */
export function throwException(
  exceptionClass: new (message: string) => HttpException,
  exceptionMessage: ExceptionMessage,
  params?: Record<string, string | number>
): never {
  const response: {
    id: string;
    message: string;
    params?: Record<string, string | number>;
  } = {
    id: exceptionMessage.id,
    message: interpolateMessage(exceptionMessage.message, params),
  };

  if (params) {
    response.params = params;
  }

  const jsonMessage = JSON.stringify(response);

  throw new exceptionClass(jsonMessage);
}

/**
 * Helper function to interpolate parameters into message
 * @param message - Original message with placeholders like {key}
 * @param params - Key-value pairs for interpolation
 *
 * @example
 * interpolateMessage('User with id={id} not found', { id: '123' })
 * // Returns: 'User with id=123 not found'
 */
function interpolateMessage(
  message: string,
  params?: Record<string, string | number>
): string {
  if (!params) {
    return message;
  }

  return Object.entries(params).reduce((result, [key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    return result.replace(regex, String(value));
  }, message);
}


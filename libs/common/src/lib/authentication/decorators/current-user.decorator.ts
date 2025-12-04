import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserDto } from '../../dtos';

/**
 * CurrentUser 데코레이터
 *
 * JWT 인증 후 요청 객체에 첨부된 user를 컨트롤러 파라미터로 주입합니다.
 *
 * @example
 * ```typescript
 * @Get('me')
 * @UseGuards(JwtAuthGuard)
 * async getMe(@CurrentUser() user: UserDto) {
 *   return user;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserDto => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);

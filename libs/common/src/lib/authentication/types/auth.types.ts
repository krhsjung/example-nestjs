import { Session as ExpressSession } from 'express-session';
import { UserDto } from '../../dtos';

/**
 * Express Session 확장
 *
 * express-session의 Session 타입을 확장하여 user 속성을 추가합니다.
 */
export interface SessionWithUser extends ExpressSession {
  user?: UserDto;
}

/**
 * Express Request 타입 확장
 *
 * Express의 Request 타입에 user 속성을 추가합니다.
 * JWT 인증 후 request.user에 UserDto를 첨부합니다.
 */
declare global {
  namespace Express {
    interface Request {
      user?: UserDto;
    }
  }
}

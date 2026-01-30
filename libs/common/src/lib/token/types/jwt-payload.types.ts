import { BaseJwtPayload } from '@example/utils';
import { AuthProvider } from '@example/utils';

/**
 * JWT 페이로드 (도메인 타입)
 *
 * 애플리케이션의 JWT 토큰에 포함되는 사용자 정보
 */
export interface JwtPayload extends BaseJwtPayload {
  sub: number; // userIdx
  email: string;
  name: string;
  picture?: string;
  provider: AuthProvider;
  maxSessions?: number;
  jti?: string; // JWT ID (세션 ID)
}

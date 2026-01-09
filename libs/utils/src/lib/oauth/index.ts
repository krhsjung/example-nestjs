export * from './apple-oauth-client';
export * from './auth.constants';
export * from './google-oauth-client';

export interface AuthCallback {
  code: string;
  state?: string;
  error?: string;
  /**
   * Apple OAuth 전용: 최초 로그인 시에만 제공되는 사용자 정보 (JSON string)
   * 예: '{"name":{"firstName":"길동","lastName":"홍"},"email":"user@example.com"}'
   */
  user?: string;
}

export interface AppleUserData {
  name?: {
    firstName?: string;
    lastName?: string;
  };
  email?: string;
}

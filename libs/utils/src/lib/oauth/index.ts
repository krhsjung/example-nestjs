export * from './apple-oauth-client';
export * from './auth.constants';
export * from './google-oauth-client';

export interface AuthCallback {
  code: string;
  state?: string;
  error?: string;
}

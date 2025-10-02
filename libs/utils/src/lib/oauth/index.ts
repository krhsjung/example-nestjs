export * from './auth.constants';
export * from './google-oauth-client';

export interface AuthCallbackQuery {
  code: string;
  state?: string;
}

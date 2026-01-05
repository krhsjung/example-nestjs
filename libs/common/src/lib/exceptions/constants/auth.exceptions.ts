/**
 * Authentication and Authorization Exception Messages
 *
 * Format: { id: string, message: string }
 * - id: Unique identifier for frontend i18n
 * - message: Default English message
 */

export const AUTH_EXCEPTIONS = {
  // Token exceptions
  TOKEN_NOT_FOUND: {
    id: 'server_auth_token_not_found',
    message: 'Access token not found',
  },
  TOKEN_INVALID: {
    id: 'server_auth_token_invalid',
    message: 'Invalid or expired token',
  },
  TOKEN_EXPIRED: {
    id: 'server_auth_token_expired',
    message: 'Token has expired',
  },
  REFRESH_TOKEN_INVALID: {
    id: 'server_auth_refresh_token_invalid',
    message: 'Invalid refresh token',
  },
  // Legacy session exceptions (deprecated)
  SESSION_NOT_FOUND: {
    id: 'server_auth_session_not_found',
    message: 'Session not found',
  },
  SESSION_INVALID: {
    id: 'server_auth_session_invalid',
    message: 'Invalid session',
  },
  // Credentials
  CREDENTIALS_INVALID: {
    id: 'server_auth_credentials_invalid',
    message: 'Invalid email or password',
  },
  // Provider
  PROVIDER_UNSUPPORTED: {
    id: 'server_auth_provider_unsupported',
    message: 'Unsupported auth provider',
  },
} as const;

export type AuthExceptionKey = keyof typeof AUTH_EXCEPTIONS;

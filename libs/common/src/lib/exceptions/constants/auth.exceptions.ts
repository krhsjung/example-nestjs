/**
 * Authentication and Authorization Exception Messages
 *
 * Format: { id: string, message: string }
 * - id: Unique identifier for frontend i18n
 * - message: Default English message
 */

export const AUTH_EXCEPTIONS = {
  SESSION_NOT_FOUND: {
    id: 'auth_session_not_found',
    message: 'Session not found',
  },
  SESSION_INVALID: {
    id: 'auth_session_invalid',
    message: 'Invalid session',
  },
  CREDENTIALS_INVALID: {
    id: 'auth_credentials_invalid',
    message: 'Invalid email or password',
  },
  PROVIDER_UNSUPPORTED: {
    id: 'auth_provider_unsupported',
    message: 'Unsupported auth provider',
  },
} as const;

export type AuthExceptionKey = keyof typeof AUTH_EXCEPTIONS;

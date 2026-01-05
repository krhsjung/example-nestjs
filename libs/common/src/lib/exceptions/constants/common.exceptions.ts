/**
 * Common/Generic Exception Messages
 *
 * Format: { id: string, message: string }
 * - id: Unique identifier for frontend i18n
 * - message: Default English message
 */

export const COMMON_EXCEPTIONS = {
  INTERNAL_SERVER_ERROR: {
    id: 'server_common_internal_server_error',
    message: 'Internal server error',
  },
  BAD_REQUEST: {
    id: 'server_common_bad_request',
    message: 'Bad request',
  },
  FORBIDDEN: {
    id: 'server_common_forbidden',
    message: 'Forbidden',
  },
  NOT_FOUND: {
    id: 'server_common_not_found',
    message: 'Resource not found',
  },
} as const;

export type CommonExceptionKey = keyof typeof COMMON_EXCEPTIONS;

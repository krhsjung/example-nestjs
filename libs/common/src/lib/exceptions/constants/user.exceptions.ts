/**
 * User Service Exception Messages
 *
 * Format: { id: string, message: string }
 * - id: Unique identifier for frontend i18n
 * - message: Default English message (can use {param} for interpolation)
 */

export const USER_EXCEPTIONS = {
  NOT_FOUND: {
    id: 'server_user_not_found',
    message: 'User with id={id} not found',
  },
  ALREADY_EXISTS: {
    id: 'server_user_already_exists',
    message: 'User with {fields} already exists',
  },
} as const;

export type UserExceptionKey = keyof typeof USER_EXCEPTIONS;

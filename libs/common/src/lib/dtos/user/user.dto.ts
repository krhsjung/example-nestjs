import { AuthProvider } from '@example/utils';

export class UserDto {
  readonly idx!: number;
  readonly name!: string;
  readonly email!: string;
  readonly picture?: string;
  readonly provider!: AuthProvider;
  readonly maxSessions?: number;
}

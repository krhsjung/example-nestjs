import { AuthProvider } from '@example/utils';

export class UserDto {
  readonly id!: string;
  readonly name!: string;
  readonly email!: string;
  readonly picture?: string;
  readonly provider!: AuthProvider;
}

import { AuthProvider } from '@example/utils';

export class RegisterDto {
  readonly name!: string;
  readonly email!: string;
  readonly password!: string;
  readonly provider: AuthProvider = AuthProvider.EMAIL;
}

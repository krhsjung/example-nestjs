import { AuthProvider } from '@example/utils';
import { IsEmail, IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @IsString()
  @IsNotEmpty()
  readonly password!: string;

  @IsEnum(AuthProvider)
  readonly provider: AuthProvider = AuthProvider.EMAIL;
}

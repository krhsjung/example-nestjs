import { UserDto } from '../user/user.dto';

export class AuthResponseDto {
  readonly accessToken!: string;
  readonly refreshToken!: string;
  readonly user!: UserDto;
}

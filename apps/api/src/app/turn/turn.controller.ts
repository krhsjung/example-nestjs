import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, UserDto } from '@example/common';
import { TurnService, IceServerConfig } from './turn.service';

@Controller('turn')
export class TurnController {
  constructor(private readonly turnService: TurnService) {}

  @UseGuards(JwtAuthGuard)
  @Get('credentials')
  getCredentials(@CurrentUser() user: UserDto): IceServerConfig {
    return this.turnService.generateCredentials(user.idx);
  }
}

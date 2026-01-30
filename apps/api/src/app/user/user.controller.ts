import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from '@example/common';

const CONTROLLER_PREFIX = 'user';

@Controller(CONTROLLER_PREFIX)
export class UserController {
  private logger = new Logger(UserController.name, { timestamp: true });

  constructor(private readonly userService: UserService) {}

  @Get(':idx')
  async findOne(@Param('idx', ParseIntPipe) idx: number): Promise<UserDto> {
    this.logger.log(`[findOne][${idx}]: user_idx ${idx}`);
    return await this.userService.fineOne(idx);
  }

  @Patch(':idx')
  async update(
    @Param('idx', ParseIntPipe) idx: number,
    @Body() userDto: UserDto
  ): Promise<UserDto> {
    this.logger.log(
      `[update][${idx}]: user_information(${JSON.stringify(userDto)})`
    );
    return this.userService.update(idx, userDto);
  }

  @Delete(':idx')
  async remove(@Param('idx', ParseIntPipe) idx: number): Promise<UserDto> {
    this.logger.log(`[remove][${idx}]: user_idx(${idx})`);
    return await this.userService.remove(idx);
  }
}

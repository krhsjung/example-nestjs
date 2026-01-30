import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from '@example/common';

const CONTROLLER_PREFIX = 'user';

@Controller(CONTROLLER_PREFIX)
export class UserController {
  private logger = new Logger(UserController.name, { timestamp: true });

  constructor(private readonly userService: UserService) {}

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserDto> {
    this.logger.log(`[findOne][${id}]: user_id ${id}`);
    return await this.userService.fineOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() userDto: UserDto
  ): Promise<UserDto> {
    this.logger.log(
      `[update][${id}]: user_information(${JSON.stringify(userDto)})`
    );
    return this.userService.update(id, userDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<UserDto> {
    this.logger.log(`[remove][${id}]: user_id(${id})`);
    return await this.userService.remove(id);
  }
}

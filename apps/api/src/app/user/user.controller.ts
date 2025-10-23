import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from '@example/common';

@Controller('user')
export class UserController {
  private logger = new Logger(UserController.name, { timestamp: true });

  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() userDto: UserDto): Promise<UserDto> {
    this.logger.log(
      `[create][${userDto.id}]: user_information(${JSON.stringify(userDto)})`
    );
    return await this.userService.create(userDto);
  }

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

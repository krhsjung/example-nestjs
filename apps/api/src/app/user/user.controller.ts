import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from '@example/common';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() userDto: UserDto): Promise<UserDto> {
    console.log(
      `[user][create][${userDto.id}]: user_information(${JSON.stringify(
        userDto
      )})`
    );
    return await this.userService.create(userDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserDto> {
    console.log(`[user][findOne][${id}]: user_id ${id}`);
    return await this.userService.fineOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() userDto: UserDto
  ): Promise<UserDto> {
    console.log(
      `[user][update][${id}]: user_information(${JSON.stringify(userDto)})`
    );
    return this.userService.update(id, userDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<UserDto> {
    console.log(`[user][remove][${id}]: user_id(${id})`);
    return await this.userService.remove(id);
  }
}

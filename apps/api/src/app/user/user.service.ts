import {
  User,
  UserDto,
  USER_EXCEPTIONS,
  throwException,
} from '@example/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>
  ) {}

  async fineOne(idx: number): Promise<User> {
    const user = await this.repo.findOne({
      where: { idx },
      select: ['idx', 'name', 'email', 'createdAt'],
    });

    if (!user) {
      throwException(NotFoundException, USER_EXCEPTIONS.NOT_FOUND);
    }

    return user;
  }

  async update(idx: number, dto: UserDto): Promise<User> {
    const user = await this.repo.findOneBy({ idx });

    if (!user) {
      throwException(NotFoundException, USER_EXCEPTIONS.NOT_FOUND);
    }

    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async remove(idx: number): Promise<User> {
    const user = await this.repo.findOneBy({ idx });
    const result = await this.repo.delete({ idx });

    if (!user || result.affected === 0) {
      throwException(NotFoundException, USER_EXCEPTIONS.NOT_FOUND);
    }

    return user;
  }
}

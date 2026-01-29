import {
  User,
  UserDto,
  USER_EXCEPTIONS,
  throwException,
} from '@example/common';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>
  ) {}

  async create(dto: UserDto): Promise<UserDto> {
    const exists = await this.repo.findOne({
      where: [{ id: dto.id }, { email: dto.email }],
    });

    if (exists) {
      throwException(ConflictException, USER_EXCEPTIONS.ALREADY_EXISTS);
    }

    const newUser = this.repo.create(dto);
    const savedUser = await this.repo.save(newUser);
    return savedUser.toDto();
  }

  async fineOne(id: string): Promise<User> {
    const user = await this.repo.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'createdAt'],
    });

    if (!user) {
      throwException(NotFoundException, USER_EXCEPTIONS.NOT_FOUND);
    }

    return user;
  }

  async update(id: string, dto: UserDto): Promise<User> {
    const user = await this.repo.findOneBy({ id: id });

    if (!user) {
      throwException(NotFoundException, USER_EXCEPTIONS.NOT_FOUND);
    }

    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async remove(id: string): Promise<User> {
    const user = await this.repo.findOneBy({ id: id });
    const result = await this.repo.delete(id);

    if (!user || result.affected === 0) {
      throwException(NotFoundException, USER_EXCEPTIONS.NOT_FOUND);
    }

    return user;
  }
}

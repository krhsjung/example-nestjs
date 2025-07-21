import { User, UserDto } from '@example/common';
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

  async create(dto: UserDto): Promise<User> {
    const exists = await this.repo.findOne({
      where: [{ id: dto.id }, { email: dto.email }],
    });

    if (exists) {
      const conflictFields: string[] = [];
      if (exists.id === dto.id) {
        conflictFields.push('id');
      }
      if (exists.email === dto.email) {
        conflictFields.push('email');
      }
      throw new ConflictException(
        `User with ${conflictFields.join(', ')} already exists.`
      );
    }

    const newUser = this.repo.create(dto);
    return this.repo.save(newUser);
  }

  async fineOne(id: string): Promise<User> {
    const user = await this.repo.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException(`User with id=${id} not found`);
    }

    return user;
  }

  async update(id: string, dto: UserDto): Promise<User> {
    const user = await this.repo.findOneBy({ id: id });

    if (!user) {
      throw new NotFoundException(`User with id=${id} not found`);
    }

    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async remove(id: string): Promise<User> {
    const user = await this.repo.findOneBy({ id: id });
    const result = await this.repo.delete(id);

    if (!user || result.affected === 0) {
      throw new NotFoundException(`User #${id} not found`);
    }

    return user;
  }
}

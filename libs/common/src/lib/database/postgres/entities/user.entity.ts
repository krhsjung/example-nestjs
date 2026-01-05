import { UserDto } from '@example/common';
import { AuthProvider } from '@example/utils';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity({ schema: 'example', name: 'user' })
export class User {
  @PrimaryColumn('varchar', { name: 'id' })
  id!: string;

  @Column({ type: 'varchar', name: 'provider', nullable: false })
  provider!: AuthProvider;

  @Column({ type: 'varchar', name: 'password', nullable: true })
  password!: string;

  @Column({ type: 'varchar', name: 'name', nullable: false })
  name!: string;

  @Column({ type: 'varchar', name: 'email', unique: true, nullable: false })
  email!: string;

  @Column({ type: 'varchar', name: 'picture', nullable: true })
  picture?: string;

  @Column({
    type: 'int',
    name: 'max_sessions',
    default: 1,
    nullable: false,
    comment: '사용자가 동시에 유지할 수 있는 최대 세션 수',
  })
  maxSessions!: number;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'updatedAt',
    nullable: false,
  })
  updatedAt?: Date;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'createdAt',
    nullable: false,
  })
  createdAt?: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  toDto(): UserDto {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      picture: this.picture,
      provider: this.provider,
      maxSessions: this.maxSessions,
    };
  }
}

import { UserDto } from '@example/common';
import { AuthProvider } from '@example/utils';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'example', name: 'user' })
export class User {
  @PrimaryGeneratedColumn({ name: 'idx' })
  idx!: number;

  @Column({ type: 'varchar', name: 'sns_id', unique: true, nullable: true })
  snsId?: string;

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
    name: 'updated_at',
    nullable: false,
  })
  updatedAt?: Date;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'created_at',
    nullable: false,
  })
  createdAt?: Date;

  toDto(): UserDto {
    return {
      idx: this.idx,
      name: this.name,
      email: this.email,
      picture: this.picture,
      provider: this.provider,
      maxSessions: this.maxSessions,
    };
  }
}

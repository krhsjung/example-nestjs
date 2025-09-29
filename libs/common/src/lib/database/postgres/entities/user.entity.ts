import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'example', name: 'user' })
export class User {
  @PrimaryColumn('varchar', { name: 'id' })
  id!: string;

  @Column({ type: 'varchar', name: 'name', nullable: false })
  name!: string;

  @Column({ type: 'varchar', name: 'email', unique: true, nullable: false })
  email!: string;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'updatedAt',
    nullable: false,
  })
  updatedAt!: Date;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'createdAt',
    nullable: false,
  })
  createdAt!: Date;
}

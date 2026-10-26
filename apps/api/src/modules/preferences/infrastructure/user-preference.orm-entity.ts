import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'user_preference' })
export class UserPreferenceOrmEntity {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  data: object;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

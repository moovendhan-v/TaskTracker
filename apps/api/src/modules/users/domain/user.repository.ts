import type { User } from './user.js';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  /** Email is matched case-insensitively. */
  abstract findByEmail(email: string): Promise<User | null>;
}

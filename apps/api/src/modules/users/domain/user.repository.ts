import type { User } from './user.js';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  /** Only accounts whose owner confirmed the email. Matched case-insensitively. */
  abstract findVerifiedByEmail(email: string): Promise<User | null>;
}

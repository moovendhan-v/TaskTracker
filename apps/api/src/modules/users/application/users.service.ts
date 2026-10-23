import { Injectable } from '@nestjs/common';
import type { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly users: UserRepository) {}

  /** Unconfirmed accounts are treated as absent, so an address can't be claimed by someone who doesn't own it. */
  findVerifiedByEmail(email: string): Promise<User | null> {
    return this.users.findVerifiedByEmail(email.trim());
  }
}

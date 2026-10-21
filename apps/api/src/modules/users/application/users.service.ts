import { Injectable } from '@nestjs/common';
import type { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly users: UserRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email.trim());
  }
}

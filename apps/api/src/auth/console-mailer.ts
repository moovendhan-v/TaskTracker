import { Logger } from '@nestjs/common';
import type { AuthMailer } from './better-auth.factory.js';

/**
 * Development mailer that prints reset links to the server log. Swap in a real
 * provider before production; it never prints links outside development.
 */
export class ConsoleMailer implements AuthMailer {
  private readonly logger = new Logger(ConsoleMailer.name);

  constructor(private readonly printLinks: boolean) {}

  async sendPasswordReset(to: string, url: string): Promise<void> {
    if (this.printLinks) {
      this.logger.log(`Password reset for ${to}: ${url}`);
      return;
    }
    this.logger.warn('Password reset requested but no mail provider is configured');
  }
}

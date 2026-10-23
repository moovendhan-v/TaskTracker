import { Logger } from '@nestjs/common';
import { Mailer } from './mailer.port.js';

/**
 * Development mailer that prints reset links to the server log. Swap in a real
 * provider before production; it never prints links outside development.
 */
export class ConsoleMailer extends Mailer {
  private readonly logger = new Logger(ConsoleMailer.name);

  constructor(private readonly printLinks: boolean) {
    super();
  }

  async sendPasswordReset(to: string, url: string): Promise<void> {
    this.print('Password reset', to, url);
  }

  async sendEmailVerification(to: string, url: string): Promise<void> {
    this.print('Email confirmation', to, url);
  }

  private print(kind: string, to: string, url: string): void {
    if (this.printLinks) this.logger.log(`${kind} for ${to}: ${url}`);
    else this.logger.warn(`${kind} requested but no mail provider is configured`);
  }
}

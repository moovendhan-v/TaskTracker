import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { Mailer } from './mailer.port.js';

/** Production mailer: plain-text email over SMTP (SMTP_URL, e.g. smtps://user:pass@smtp.example.com:465). */
export class SmtpMailer extends Mailer {
  private readonly logger = new Logger(SmtpMailer.name);
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    super();
    // Bounded timeouts, so a slow mail server can't hold auth requests open.
    this.transport = createTransport({ url: smtpUrl, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  }

  async sendPasswordReset(to: string, url: string): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.from,
        to,
        subject: 'Reset your TaskFlow password',
        text: [
          'Someone asked to reset the password for your TaskFlow account.',
          '',
          `Choose a new password here (the link works once, for 30 minutes): ${url}`,
          '',
          "If this wasn't you, ignore this email. Your password stays the same.",
        ].join('\n'),
      });
    } catch (error) {
      // The caller always answers the same way (no account enumeration), so log and carry on.
      this.logger.error(`Password reset email could not be sent: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}

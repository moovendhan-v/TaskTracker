import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { Env } from '../config/env.schema.js';

/** Unknown fields are rejected rather than stripped, so clients can't mass-assign. */
export function applyValidation(app: INestApplication, env: Env): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: env.NODE_ENV === 'production',
    }),
  );
}

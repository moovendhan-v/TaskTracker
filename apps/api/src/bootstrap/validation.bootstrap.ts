import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { Env } from '../config/env.schema.js';
import { FieldValidationException } from '../core/forms/field-validation.exception.js';

/**
 * Unknown fields are rejected rather than stripped, so clients can't mass-assign.
 * Failures carry one readable message per field (the same wording the form
 * schemas publish), so forms can show server-side errors next to the right input.
 * These messages describe input rules only, never internals, so they stay on in
 * production.
 */
export function applyValidation(app: INestApplication, _env: Env): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: true, value: false },
      exceptionFactory: (errors) => FieldValidationException.fromValidationErrors(errors),
    }),
  );
}

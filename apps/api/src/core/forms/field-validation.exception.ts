import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { FieldError } from '@taskflow/shared-types';
import { fieldErrors } from './describe-rules.js';

/** A request that failed input validation, with a readable message per field. */
export class FieldValidationException extends BadRequestException {
  constructor(readonly fields: FieldError[]) {
    super(fields[0]?.message ?? 'Invalid input');
  }

  static fromValidationErrors(errors: ValidationError[]): FieldValidationException {
    return new FieldValidationException(fieldErrors(errors));
  }
}

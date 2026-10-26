import { plainToInstance } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength, validate } from 'class-validator';
import type { FieldError } from '@taskflow/shared-types';
import { fieldErrors } from '../forms/describe-rules.js';
import { IsNotBlank, Label, SameAs } from '../forms/form-field.decorators.js';
import { FormSchema } from '../forms/form-schema.decorators.js';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const USER_NAME_MAX = 80;
const EMAIL_MAX = 254;

/*
 * The rules for the public auth forms. Better Auth handles these requests, so a
 * `before` hook (better-auth.factory.ts) checks bodies against these classes,
 * and the web app validates with the same rules through the form schemas.
 */

@FormSchema('auth.signIn')
export class SignInForm {
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(EMAIL_MAX)
  email: string;

  @IsString()
  @IsNotBlank({ message: 'Enter your password' })
  @MaxLength(PASSWORD_MAX)
  password: string;
}

@FormSchema('auth.signUp')
export class SignUpForm {
  @Label('Name')
  @IsString()
  @IsNotBlank({ message: 'Enter your name' })
  @MaxLength(USER_NAME_MAX)
  name: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(EMAIL_MAX)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password: string;
}

@FormSchema('auth.forgotPassword')
export class ForgotPasswordForm {
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(EMAIL_MAX)
  email: string;
}

@FormSchema('auth.resetPassword')
export class ResetPasswordForm {
  @Label('New password')
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password: string;

  @Label('Confirmation')
  @IsString()
  @SameAs('password', { message: 'Passwords do not match' })
  confirm: string;
}

/** Better Auth paths and how their JSON bodies map onto the form classes. */
export const AUTH_FORM_BODIES: Record<string, (body: Record<string, unknown>) => { form: new () => object; values: Record<string, unknown> }> = {
  '/sign-in/email': (body) => ({ form: SignInForm, values: { email: body['email'], password: body['password'] } }),
  '/sign-up/email': (body) => ({ form: SignUpForm, values: { name: body['name'], email: body['email'], password: body['password'] } }),
  '/request-password-reset': (body) => ({ form: ForgotPasswordForm, values: { email: body['email'] } }),
  '/reset-password': (body) => ({ form: ResetPasswordForm, values: { password: body['newPassword'], confirm: body['newPassword'] } }),
};

/** Field errors for a Better Auth request body, or an empty list when it's valid or the path has no form. */
export async function validateAuthBody(path: string, body: unknown): Promise<FieldError[]> {
  const mapping = AUTH_FORM_BODIES[path];
  if (!mapping) return [];
  const { form, values } = mapping(body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
  const errors = await validate(plainToInstance(form, values), { validationError: { target: true, value: false } });
  return fieldErrors(errors);
}

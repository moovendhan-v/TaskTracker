import { z } from 'zod';

/** Mirrors the server's rules so users see problems before submitting. The server still validates. */
export const PASSWORD_MIN = 10;

export const emailSchema = z.email('Enter a valid email address').max(254);
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(128, 'Use at most 128 characters');

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password') });
export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: emailSchema,
  password: passwordSchema,
});
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((values) => values.password === values.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

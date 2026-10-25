/** Field values of the auth forms. Their rules come from the API (`formSchemas('auth.*')`). */
export interface SignInValues {
  email: string;
  password: string;
}

export interface SignUpValues {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordValues {
  email: string;
}

export interface ResetPasswordValues {
  password: string;
  confirm: string;
}

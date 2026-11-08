import { Module } from '@nestjs/common';
// Registers the auth forms, which Better Auth (not GraphQL) handles.
import '../../core/auth/auth-forms.js';
import { FormSchemaResolver } from './presentation/graphql/form-schema.resolver.js';
import { SignInOptionsResolver } from './presentation/graphql/sign-in-options.resolver.js';

/**
 * The `formSchemas` query: every @FormSchema input class's rules, for client-side validation;
 * and `signInOptions`, which ways of signing in the sign-in page should offer.
 */
@Module({ providers: [FormSchemaResolver, SignInOptionsResolver] })
export class FormsModule {}

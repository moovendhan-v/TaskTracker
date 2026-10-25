import { Module } from '@nestjs/common';
// Registers the auth forms, which Better Auth (not GraphQL) handles.
import '../../core/auth/auth-forms.js';
import { FormSchemaResolver } from './presentation/graphql/form-schema.resolver.js';

/** The `formSchemas` query: every @FormSchema input class's rules, for client-side validation. */
@Module({ providers: [FormSchemaResolver] })
export class FormsModule {}

import { Args, Query, Resolver } from '@nestjs/graphql';
import { describeForm, formNames } from '../../../../core/forms/form-schema.decorators.js';
import { Public } from '../../../../core/http/decorators/public.decorator.js';
import { FormSchemaGql } from './form-schema.types.js';

@Resolver(() => FormSchemaGql)
export class FormSchemaResolver {
  // Public: the sign-in and sign-up pages need their rules before anyone is signed in.
  // Returns validation rules only, no data, and the global rate limit applies.
  @Public()
  @Query(() => [FormSchemaGql], { description: 'Validation rules for the named forms, or all of them' })
  formSchemas(@Args('names', { type: () => [String], nullable: true }) names: string[] | null): FormSchemaGql[] {
    // Unknown names are skipped; the list is short and bounded by the query token limit.
    return (names ?? formNames()).slice(0, 50).flatMap((name) => describeForm(name) ?? []);
  }
}

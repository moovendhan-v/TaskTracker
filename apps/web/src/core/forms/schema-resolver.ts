import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import { validateForm, type FormSchema } from '@taskflow/shared-types';

/**
 * A react-hook-form resolver that checks values with the API's published rules.
 * Until the rules have loaded it lets everything through; the server checks
 * every submit anyway and its field errors land in the same places.
 */
export function schemaResolver<T extends FieldValues>(schema: FormSchema | undefined): Resolver<T> {
  return (values) => {
    const problems = schema ? validateForm(schema, values) : [];
    if (problems.length === 0) return { values, errors: {} };
    const errors = Object.fromEntries(problems.map((problem) => [problem.field, { type: 'validate', message: problem.message }])) as FieldErrors<T>;
    return { values: {}, errors };
  };
}

import { useQuery } from '@tanstack/react-query';
import type { FormSchema } from '@taskflow/shared-types';
import { fetchFormSchemas } from '@/core/api/form-schemas.api';

export const FORM_SCHEMAS_KEY = ['form-schemas'] as const;

/** All forms' rules, loaded once per session (they only change with a deploy). */
export const formSchemasQuery = {
  queryKey: FORM_SCHEMAS_KEY,
  queryFn: fetchFormSchemas,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
} as const;

/** The rules for one form, or undefined while they load (the server still validates every submit). */
export function useFormSchema(name: string): FormSchema | undefined {
  const { data } = useQuery(formSchemasQuery);
  return data?.get(name);
}

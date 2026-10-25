import { useCallback, useMemo } from 'react';
import { useForm, type FieldValues, type Path, type UseFormProps, type UseFormReturn } from 'react-hook-form';
import { GraphQLRequestError } from '@taskflow/sdk';
import type { FieldError, FormSchema } from '@taskflow/shared-types';
import { schemaResolver } from './schema-resolver';
import { useFormSchema } from './use-form-schema';

export interface FieldHints {
  required: boolean;
  minLength?: number;
  maxLength?: number;
}

export interface ServerForm<T extends FieldValues> {
  form: UseFormReturn<T>;
  schema: FormSchema | undefined;
  /** Puts per-field errors from a failed submit next to their inputs. Returns true when it placed any. */
  applyServerErrors: (error: unknown) => boolean;
  /** `required` and `maxLength` for an input, from the same rules. */
  hints: (field: Path<T>) => FieldHints;
}

/**
 * react-hook-form wired to a form schema from the API (`formSchemas`), so the
 * browser checks input with exactly the rules the server enforces and shows the
 * server's own messages when a submit fails anyway.
 *
 *   const { form, applyServerErrors, hints } = useServerForm<Values>('task.create', { defaultValues });
 */
export function useServerForm<T extends FieldValues>(formName: string, options: UseFormProps<T> = {}): ServerForm<T> {
  const schema = useFormSchema(formName);
  const resolver = useMemo(() => schemaResolver<T>(schema), [schema]);
  const form = useForm<T>({ ...options, resolver });

  const applyServerErrors = useCallback(
    (error: unknown) => {
      const fields = fieldErrorsOf(error);
      const known = new Set(Object.keys(form.getValues()));
      let placed = false;
      for (const { field, message } of fields) {
        if (!known.has(field)) continue;
        form.setError(field as Path<T>, { type: 'server', message }, { shouldFocus: !placed });
        placed = true;
      }
      return placed;
    },
    [form],
  );

  const hints = useCallback(
    (field: Path<T>): FieldHints => {
      const rules = schema?.fields.find((candidate) => candidate.name === field);
      const limit = (kind: 'minLength' | 'maxLength') => rules?.rules.find((rule) => rule.kind === kind)?.value;
      const minLength = limit('minLength');
      const maxLength = limit('maxLength');
      return { required: rules?.required ?? false, ...(minLength ? { minLength: Number(minLength) } : {}), ...(maxLength ? { maxLength: Number(maxLength) } : {}) };
    },
    [schema],
  );

  return { form, schema, applyServerErrors, hints };
}

/** True when an error carries per-field messages, which forms show next to the inputs instead of on top. */
export function hasFieldErrors(error: unknown): boolean {
  return fieldErrorsOf(error).length > 0;
}

/** Field errors from a GraphQL BAD_USER_INPUT error or a Better Auth validation error. */
export function fieldErrorsOf(error: unknown): FieldError[] {
  if (error instanceof GraphQLRequestError) return error.fieldErrors;
  const fields = error && typeof error === 'object' ? (error as { fields?: unknown }).fields : undefined;
  if (!Array.isArray(fields)) return [];
  return fields.filter((item): item is FieldError => !!item && typeof item === 'object' && typeof item.field === 'string' && typeof item.message === 'string');
}

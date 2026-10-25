import { FormSchemasDocument } from '@taskflow/sdk';
import { FORM_FIELD_TYPES, FORM_RULE_KINDS, type FormFieldType, type FormRuleKind, type FormSchema } from '@taskflow/shared-types';
import { graphql } from './graphql-client';

const RULE_KINDS = new Set<string>(FORM_RULE_KINDS);
const FIELD_TYPES = new Set<string>(FORM_FIELD_TYPES);

/** Every form's validation rules, as the API publishes them. Unknown rule kinds from a newer API are skipped. */
export async function fetchFormSchemas(): Promise<Map<string, FormSchema>> {
  const { formSchemas } = await graphql(FormSchemasDocument, {});
  return new Map(
    formSchemas.map((form) => [
      form.name,
      {
        name: form.name,
        fields: form.fields.map((field) => ({
          ...field,
          type: (FIELD_TYPES.has(field.type) ? field.type : 'string') as FormFieldType,
          rules: field.rules.filter((rule) => RULE_KINDS.has(rule.kind)).map((rule) => ({ ...rule, kind: rule.kind as FormRuleKind })),
        })),
      },
    ]),
  );
}

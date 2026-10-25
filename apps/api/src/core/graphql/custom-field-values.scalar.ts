import { GraphQLError, GraphQLScalarType, Kind, valueFromASTUntyped, type ValueNode } from 'graphql';
import type { CustomFieldValues } from '@taskflow/shared-types';

const MAX_KEYS = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = (message: string): never => {
  throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
};

/** Shape only: field ids as keys, simple values. Types are checked against each field by the service. */
export function parseCustomFieldValues(value: unknown): CustomFieldValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('Custom fields must be an object of field id → value');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_KEYS) invalid(`Set at most ${MAX_KEYS} custom fields at once`);
  const result: CustomFieldValues = {};
  for (const [key, item] of entries) {
    if (!UUID.test(key)) invalid('Custom field keys are field ids');
    const scalar = (v: unknown) => v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 2000);
    if (Array.isArray(item) ? item.length <= 50 && item.every((v) => typeof v === 'string' && v.length <= 64) : scalar(item)) {
      result[key] = item as CustomFieldValues[string];
    } else {
      invalid('Custom field values are text, numbers, true/false, null or a list of option ids');
    }
  }
  return result;
}

export const CustomFieldValuesScalar = new GraphQLScalarType<CustomFieldValues, CustomFieldValues>({
  name: 'CustomFieldValues',
  description: 'Custom field values keyed by field id',
  serialize: (value) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as CustomFieldValues) : {}),
  parseValue: parseCustomFieldValues,
  parseLiteral: (ast: ValueNode, variables) => {
    if (ast.kind !== Kind.OBJECT) return invalid('Custom fields must be an object');
    return parseCustomFieldValues(valueFromASTUntyped(ast, variables));
  },
});

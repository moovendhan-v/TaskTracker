import { GraphQLError, GraphQLScalarType, Kind, valueFromASTUntyped, type ValueNode } from 'graphql';
import { JSON_KEY_PATTERN, METADATA_LIMITS, type TaskMetadata } from '@taskflow/shared-types';

const invalid = (message: string): never => {
  throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
};

/** Checks a flat key/value object: limited keys, safe key names, scalar values of limited length. */
export function parseMetadata(value: unknown): TaskMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('Metadata must be an object');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > METADATA_LIMITS.maxKeys) invalid(`Metadata can have at most ${METADATA_LIMITS.maxKeys} keys`);
  const result: TaskMetadata = {};
  for (const [key, item] of entries) {
    if (!JSON_KEY_PATTERN.test(key)) invalid(`Metadata keys use letters, digits, - and _ (up to 64): "${key.slice(0, 64)}"`);
    if (item === null || typeof item === 'boolean') result[key] = item;
    else if (typeof item === 'number' && Number.isFinite(item)) result[key] = item;
    else if (typeof item === 'string' && item.length <= METADATA_LIMITS.maxValueLength) result[key] = item;
    else invalid(`Metadata "${key}" must be text (up to ${METADATA_LIMITS.maxValueLength} characters), a number, true/false or null`);
  }
  return result;
}

/** Flat key/value data on a task. Values are text, numbers, booleans or null. */
export const MetadataScalar = new GraphQLScalarType<TaskMetadata, TaskMetadata>({
  name: 'Metadata',
  description: 'Flat key/value data: up to 50 keys, values are text, numbers, booleans or null',
  serialize: (value) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as TaskMetadata) : {}),
  parseValue: parseMetadata,
  parseLiteral: (ast: ValueNode, variables) => {
    if (ast.kind !== Kind.OBJECT) return invalid('Metadata must be an object');
    return parseMetadata(valueFromASTUntyped(ast, variables));
  },
});

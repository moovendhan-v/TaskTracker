import { GraphQLError, GraphQLScalarType } from 'graphql';

const outputOnly = (): never => {
  throw new GraphQLError('JSONObject is output only', { extensions: { code: 'BAD_USER_INPUT' } });
};

/** Output-only JSON object, used for audit metadata. It can't be sent as input. */
export const JSONObjectScalar = new GraphQLScalarType<Record<string, unknown>, Record<string, unknown>>({
  name: 'JSONObject',
  description: 'A JSON object (read-only)',
  serialize: (value) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}),
  parseValue: outputOnly,
  parseLiteral: outputOnly,
});

/** Shape of an error in a GraphQL response, kept local so the SDK has no runtime graphql dependency. */
export interface GraphQLFormattedError {
  message: string;
  path?: readonly (string | number)[];
  extensions?: Record<string, unknown>;
}

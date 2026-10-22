import { createGraphQLClient } from '@taskflow/sdk';

/**
 * The only TaskFlow API client in the app. Every call is a typed GraphQL
 * operation from @taskflow/sdk, sent to the same origin (`/api/graphql`): the
 * Vite dev proxy or nginx forwards it to the API.
 */
export const graphql = createGraphQLClient();

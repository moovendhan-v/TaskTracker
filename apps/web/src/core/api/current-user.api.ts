import { MeDocument } from '@taskflow/sdk';
import { graphql } from './graphql-client';

/** The signed-in user. Used by route guards and the user menu. */
export const fetchCurrentUser = async () => (await graphql(MeDocument, {})).me;

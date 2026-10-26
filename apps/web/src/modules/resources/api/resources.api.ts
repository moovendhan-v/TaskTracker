import { ResourceSchemaDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const resourcesApi = {
  schema: async (workspaceId: string, resource: string) => (await graphql(ResourceSchemaDocument, { workspaceId, resource })).resourceSchema,
};

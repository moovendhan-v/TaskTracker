import { Md2SlidesCatalogDocument } from '@taskflow/sdk';
import type { Md2SlidesCatalogResponse } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

export const md2slidesApi = {
  catalog: async (workspaceId: string): Promise<Md2SlidesCatalogResponse> => (await graphql(Md2SlidesCatalogDocument, { workspaceId })).md2slidesCatalog as Md2SlidesCatalogResponse,
};

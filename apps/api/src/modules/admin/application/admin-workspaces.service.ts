import { Injectable } from '@nestjs/common';
import type { AdminWorkspaceQuery, AdminWorkspaceResponse, Paginated } from '@taskflow/shared-types';
import { toPageRequest } from '../../../core/http/dto/page-query.dto.js';
import { AdminWorkspaceRepository } from '../domain/admin-workspace.repository.js';
import { AdminMapper } from './admin.mapper.js';

@Injectable()
export class AdminWorkspacesService {
  constructor(private readonly workspaces: AdminWorkspaceRepository) {}

  async list(query: AdminWorkspaceQuery): Promise<Paginated<AdminWorkspaceResponse>> {
    const page = toPageRequest(query);
    const result = await this.workspaces.page(query.search?.trim() || undefined, page);
    return { items: result.items.map(AdminMapper.workspace), total: result.total, ...page };
  }
}

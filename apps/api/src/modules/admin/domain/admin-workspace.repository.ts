import type { PageRequest } from '../../../core/http/dto/page-query.dto.js';
import type { AdminWorkspace } from './admin-user.js';

export abstract class AdminWorkspaceRepository {
  /** Newest first; search matches the workspace name. */
  abstract page(search: string | undefined, page: PageRequest): Promise<{ items: AdminWorkspace[]; total: number }>;
}

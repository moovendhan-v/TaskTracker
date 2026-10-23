import type { PlatformRole } from '@taskflow/shared-types';
import type { PageRequest } from '../../../core/domain/page-request.js';
import type { AdminUser } from './admin-user.js';

export abstract class AdminUserRepository {
  /** Newest first; search matches name or email. */
  abstract page(search: string | undefined, page: PageRequest): Promise<{ items: AdminUser[]; total: number }>;
  abstract findById(userId: string): Promise<AdminUser | null>;
  /** Locks the active super admin rows until the transaction ends and counts them. */
  abstract countActiveSuperAdminsForUpdate(): Promise<number>;
  abstract update(userId: string, changes: { suspended?: boolean; platformRole?: PlatformRole }): Promise<void>;
  /** Signs the user out everywhere. */
  abstract revokeSessions(userId: string): Promise<void>;
}

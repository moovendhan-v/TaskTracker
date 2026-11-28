import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BUG_SHARE_DAYS, SHARE_TOKEN_PREFIX, TRACKING_LINK_DAYS, type BugShareResponse, type BugShareScope, type CreatedBugShare, type PublicBugView } from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { TaskAttachmentsService } from '../../attachments/application/task-attachments.service.js';
import { BugsService } from '../../bugs/application/bugs.service.js';
import { IntakeRepository, type ShareRecord } from '../domain/intake.repository.js';

const TOKEN = new RegExp(`^${SHARE_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const newShareToken = () => `${SHARE_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;

/** Read-only access to one report, for building a public view with nobody signed in. */
export function viewerAccess(workspaceId: string): WorkspaceAccess {
  return { workspaceId, roleId: null, permissions: new Set(['task.view']), readableFields: new Set(), spaceRules: [], viaPlatformRole: false };
}

/**
 * Read-only links to one bug report. A member with task.update in its project makes a `full` link
 * for someone outside the workspace (a client, a vendor); reporters from the portal or widget get a
 * `status` link to follow theirs. Tokens are random, shown once, stored hashed, expire, and can be
 * revoked; making and revoking a link is audited.
 */
@Injectable()
export class BugSharesService {
  constructor(
    private readonly intake: IntakeRepository,
    private readonly bugs: BugsService,
    private readonly attachments: TaskAttachmentsService,
    private readonly transactional: TransactionalManager,
    private readonly audit: AuditLogger,
  ) {}

  async create(actor: Actor, access: WorkspaceAccess, taskId: string, scope: BugShareScope, days: number): Promise<CreatedBugShare> {
    if (!(BUG_SHARE_DAYS as readonly number[]).includes(days)) throw DomainError.invalid('Links last 1, 7 or 30 days');
    const bug = await this.bugs.get(access, taskId);
    SpaceGuard.assert(bug.spaceId, 'task.update');
    const token = newShareToken();
    const share = await this.intake.insertShare({ workspaceId: access.workspaceId, taskId, tokenHash: sha256(token), scope, createdBy: actor.userId, expiresAt: new Date(Date.now() + days * 86_400_000) });
    await this.audit.record(actor, { action: 'bug_share.create', targetType: 'task', targetId: taskId, workspaceId: access.workspaceId, metadata: { shareId: share.id, scope, days } });
    return { share: toResponse(share), path: `/s/${token}` };
  }

  /** The link a portal or widget reporter gets (inside the report's scope). */
  async createTracking(workspaceId: string, taskId: string): Promise<string> {
    const token = newShareToken();
    await this.intake.insertShare({ workspaceId, taskId, tokenHash: sha256(token), scope: 'status', createdBy: null, expiresAt: new Date(Date.now() + TRACKING_LINK_DAYS * 86_400_000) });
    return `/f/track/${token}`;
  }

  async list(access: WorkspaceAccess, taskId: string): Promise<BugShareResponse[]> {
    await this.bugs.get(access, taskId);
    return (await this.intake.listShares(access.workspaceId, taskId)).map(toResponse);
  }

  async revoke(actor: Actor, access: WorkspaceAccess, shareId: string): Promise<boolean> {
    const share = await this.intake.revokeShare(access.workspaceId, shareId);
    if (!share) throw DomainError.notFound('Link');
    const bug = await this.bugs.get(access, share.taskId);
    SpaceGuard.assert(bug.spaceId, 'task.update');
    await this.audit.record(actor, { action: 'bug_share.revoke', targetType: 'task', targetId: share.taskId, workspaceId: access.workspaceId, metadata: { shareId } });
    return true;
  }

  /** What a link shows. Unknown, expired and revoked links all look the same: not found. */
  async view(token: string): Promise<PublicBugView> {
    if (!TOKEN.test(token)) throw DomainError.notFound('Link');
    const share = await this.transactional.runInScope({ kind: 'platform' }, () => this.intake.findShareByHash(sha256(token)));
    if (!share || share.revokedAt || share.expiresAt.getTime() <= Date.now()) throw DomainError.notFound('Link');
    return this.transactional.runInScope({ kind: 'workspace', workspaceId: share.workspaceId, userId: null }, async () => {
      const access = viewerAccess(share.workspaceId);
      const bug = await this.bugs.get(access, share.taskId);
      await this.intake.touchShare(share.workspaceId, share.id);
      const full = share.scope === 'full';
      const files = full ? await this.attachments.list(access, share.taskId) : [];
      return {
        scope: share.scope,
        number: bug.number,
        title: bug.title,
        kind: bug.kind,
        severity: full ? bug.severity : null,
        environment: full ? bug.environment : null,
        qaState: bug.qaState,
        statusName: bug.statusName,
        statusCategory: bug.statusCategory,
        source: bug.source,
        createdAt: bug.createdAt,
        updatedAt: bug.updatedAt,
        expected: full ? bug.expected : null,
        actual: full ? bug.actual : null,
        steps: full ? bug.steps : [],
        pageUrl: full ? bug.pageUrl : null,
        browser: full ? bug.browser : null,
        os: full ? bug.os : null,
        viewport: full ? bug.viewport : null,
        files: files.map((file) => ({ fileName: file.fileName, url: file.url, isImage: file.isImage, isVideo: /\.(webm|mp4)$/i.test(file.fileName) })),
        capture: full ? await this.bugs.capture(access, share.taskId) : null,
        expiresAt: share.expiresAt.toISOString(),
      };
    });
  }
}

function toResponse(share: ShareRecord): BugShareResponse {
  return {
    id: share.id,
    scope: share.scope,
    createdAt: share.createdAt.toISOString(),
    expiresAt: share.expiresAt.toISOString(),
    lastViewedAt: share.lastViewedAt?.toISOString() ?? null,
    createdByName: share.createdBy ? share.createdByName : 'Reporter (tracking link)',
  };
}

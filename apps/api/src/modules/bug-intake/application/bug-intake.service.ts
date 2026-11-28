import { randomBytes } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  BUG_KINDS,
  BUG_LIMITS,
  INTAKE_KEY_PREFIX,
  INTAKE_LIMITS,
  type BugIntakeResponse,
  type BugKind,
  type PublicIntakeConfig,
  type PublicReportRequest,
  type PublicReportResponse,
  type SaveBugIntakeRequest,
} from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { CaptchaVerifier } from '../../../core/captcha/captcha-verifier.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { TaskAttachmentsService } from '../../attachments/application/task-attachments.service.js';
import { BugsService } from '../../bugs/application/bugs.service.js';
import { parseCapture } from '../../bugs/domain/parse-capture.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { IntakeRepository, type IntakeRecord } from '../domain/intake.repository.js';
import { BugSharesService } from './bug-shares.service.js';

const KEY = new RegExp(`^${INTAKE_KEY_PREFIX}[A-Za-z0-9_-]{32}$`);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const SCREENSHOT = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const PUBLIC_KINDS: readonly BugKind[] = BUG_KINDS;
const newKey = () => `${INTAKE_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;

export interface RequestMeta {
  origin: string | null;
  ip: string | null;
}

/**
 * The public way into a project (E6.3): the feedback widget on the sites listed for it and the
 * hosted feedback portal. Admins of the project (space.manage) turn it on; reports are filed as
 * the admin who did (their current access applies, so if they lose it the intake stops) and are
 * marked with the outside reporter's name and source. Guards on the public side: an origin
 * allowlist, CAPTCHA, a hidden honeypot field, per-IP throttling (controller) and a per-project
 * hourly cap; everything is validated, redacted and type-checked like any other report.
 */
@Injectable()
export class BugIntakeService {
  constructor(
    private readonly intake: IntakeRepository,
    private readonly bugs: BugsService,
    private readonly shares: BugSharesService,
    private readonly attachments: TaskAttachmentsService,
    private readonly spaces: SpacesService,
    private readonly accessService: AccessService,
    private readonly captcha: CaptchaVerifier,
    private readonly transactional: TransactionalManager,
    private readonly audit: AuditLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async get(access: WorkspaceAccess, spaceId: string): Promise<BugIntakeResponse | null> {
    SpaceGuard.assert(spaceId, 'space.manage');
    const record = await this.intake.findBySpace(access.workspaceId, spaceId);
    return record ? toResponse(record) : null;
  }

  async save(actor: Actor, access: WorkspaceAccess, spaceId: string, request: SaveBugIntakeRequest): Promise<BugIntakeResponse> {
    SpaceGuard.assert(spaceId, 'space.manage');
    const space = await this.spaces.getInWorkspace(access.workspaceId, spaceId);
    const title = request.title.replace(/\s+/g, ' ').trim().slice(0, INTAKE_LIMITS.title) || `Feedback for ${space.name}`;
    const intro = (request.intro ?? '').trim().slice(0, INTAKE_LIMITS.intro);
    const allowedOrigins = [...new Set(request.allowedOrigins.map(normalizeOrigin))];
    if (allowedOrigins.length > INTAKE_LIMITS.origins) throw DomainError.invalid(`Up to ${INTAKE_LIMITS.origins} sites`);
    if (request.widgetEnabled && !allowedOrigins.length) throw DomainError.invalid('Add the site (for example https://shop.example.com) that will show the feedback button');
    const existing = await this.intake.findBySpace(access.workspaceId, spaceId);
    const record = await this.intake.save(access.workspaceId, spaceId, actor.userId, existing?.publicKey ?? newKey(), {
      title,
      intro,
      allowedOrigins,
      widgetEnabled: request.widgetEnabled,
      portalEnabled: request.portalEnabled,
    });
    await this.audit.record(actor, { action: 'bug_intake.update', targetType: 'space', targetId: spaceId, workspaceId: access.workspaceId, metadata: { widget: record.widgetEnabled, portal: record.portalEnabled, origins: allowedOrigins } });
    return toResponse(record);
  }

  /** A new public key: the old one stops working at once (embedded snippets need the new one). */
  async rotate(actor: Actor, access: WorkspaceAccess, spaceId: string): Promise<BugIntakeResponse> {
    SpaceGuard.assert(spaceId, 'space.manage');
    const record = await this.intake.rotateKey(access.workspaceId, spaceId, newKey());
    if (!record) throw DomainError.notFound('Feedback settings');
    await this.audit.record(actor, { action: 'bug_intake.rotate_key', targetType: 'space', targetId: spaceId, workspaceId: access.workspaceId });
    return toResponse(record);
  }

  async publicConfig(key: string): Promise<PublicIntakeConfig> {
    const record = await this.byKey(key);
    if (!record.widgetEnabled && !record.portalEnabled) throw DomainError.notFound('Feedback form');
    return { title: record.title, intro: record.intro, widget: record.widgetEnabled, portal: record.portalEnabled, captchaSiteKey: this.captcha.siteKey };
  }

  async submit(key: string, request: PublicReportRequest, meta: RequestMeta): Promise<PublicReportResponse> {
    const record = await this.byKey(key);
    const fromWidget = request.via === 'widget';
    if (!(fromWidget ? record.widgetEnabled : record.portalEnabled)) throw DomainError.notFound('Feedback form');
    // Browsers always send Origin on these POSTs: the widget's must be one of the project's sites,
    // the portal's TaskFlow itself.
    const allowed = fromWidget ? record.allowedOrigins : this.env.CORS_ORIGINS;
    if (!meta.origin || !allowed.includes(meta.origin)) throw DomainError.forbidden('This site can’t send feedback to this project');
    if (request.website) throw DomainError.invalid('Your report could not be sent');
    if (!(await this.captcha.verify(request.captchaToken, meta.ip))) throw DomainError.forbidden('The CAPTCHA check failed. Try again.');

    const title = request.title.replace(/\s+/g, ' ').trim();
    if (title.length < 3) throw DomainError.invalid('Add a short title');
    const email = request.email?.trim() || null;
    if (email && (email.length > INTAKE_LIMITS.reporterEmail || !EMAIL.test(email))) throw DomainError.invalid('That email address doesn’t look right');
    const name = request.name?.replace(/\s+/g, ' ').trim().slice(0, INTAKE_LIMITS.reporterName) || null;
    const screenshot = decodeScreenshot(request.screenshot);

    // Filed as the admin who turned the intake on, with their access today.
    const access = await this.accessService.resolveMember(record.createdBy, record.workspaceId);
    if (!access || !access.permissions.has('task.create')) throw DomainError.notFound('Feedback form');
    const actor: Actor = { userId: record.createdBy, platformRole: 'USER', ip: meta.ip };
    return this.transactional.runInScope({ kind: 'workspace', workspaceId: record.workspaceId, userId: record.createdBy, ...(access.spaceRules.length ? { spaceRules: access.spaceRules } : {}) }, async () => {
      const since = new Date(Date.now() - 60 * 60_000);
      if ((await this.intake.countPublicReports(record.workspaceId, record.spaceId, since)) >= INTAKE_LIMITS.perProjectHour) {
        throw new HttpException('This project is getting a lot of feedback right now. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
      const bug = await this.bugs.report(
        actor,
        access,
        {
          spaceId: record.spaceId,
          title: title.slice(0, BUG_LIMITS.title),
          kind: PUBLIC_KINDS.includes(request.kind as BugKind) ? request.kind! : 'bug',
          severity: 'P3',
          environment: 'production',
          expected: request.expected ?? null,
          actual: request.actual ?? null,
          steps: (request.steps ?? []).slice(0, 20),
          context: request.context ?? null,
          capture: parseCapture(request.captureJson),
        },
        fromWidget ? 'sdk' : 'portal',
        { name: name ?? (email ? null : 'Anonymous'), email },
      );
      if (screenshot) {
        // A refused screenshot (not really an image) is dropped; the report stands.
        await this.attachments.attachBytes(actor, access, bug.taskId, `screenshot.${screenshot.extension}`, screenshot.bytes).catch(() => undefined);
      }
      const trackingPath = await this.shares.createTracking(record.workspaceId, bug.taskId);
      return { number: bug.number, trackingPath };
    }, { readOnly: false });
  }

  private async byKey(key: string): Promise<IntakeRecord> {
    if (!KEY.test(key)) throw DomainError.notFound('Feedback form');
    const record = await this.transactional.runInScope({ kind: 'platform' }, () => this.intake.findByKey(key));
    if (!record) throw DomainError.notFound('Feedback form');
    return record;
  }
}

/** https://host[:port] only (http just for this computer); paths and wildcards are refused. */
export function normalizeOrigin(input: string): string {
  const value = input.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw DomainError.invalid(`“${value.slice(0, 80)}” is not a web address`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw DomainError.invalid(`Use https:// for ${url.host}`);
  if (url.username || url.password || url.hostname.includes('*')) throw DomainError.invalid(`“${value.slice(0, 80)}” can’t be used`);
  return url.origin;
}

function decodeScreenshot(value: string | null | undefined): { bytes: Buffer; extension: string } | null {
  if (!value) return null;
  const match = SCREENSHOT.exec(value);
  if (!match) throw DomainError.invalid('The screenshot must be a PNG, JPEG or WebP image');
  const bytes = Buffer.from(match[2]!, 'base64');
  if (bytes.length > INTAKE_LIMITS.screenshotBytes) throw DomainError.invalid('The screenshot is too large');
  return { bytes, extension: match[1] === 'jpeg' ? 'jpg' : match[1]! };
}

function toResponse(record: IntakeRecord): BugIntakeResponse {
  return {
    id: record.id,
    spaceId: record.spaceId,
    publicKey: record.publicKey,
    title: record.title,
    intro: record.intro,
    allowedOrigins: record.allowedOrigins,
    widgetEnabled: record.widgetEnabled,
    portalEnabled: record.portalEnabled,
    updatedAt: record.updatedAt.toISOString(),
  };
}

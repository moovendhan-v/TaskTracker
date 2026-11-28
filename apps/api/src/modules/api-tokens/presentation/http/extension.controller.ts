import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TASK_UPLOAD_MAX_BYTES, type ApiTokenScope, type BugResponse, type ExtensionSessionResponse, type Permission, type SimilarBugResponse, type TaskUploadResult, type TaskUploadTicket } from '@taskflow/shared-types';
import { IsInt, IsNotEmpty, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { AccessService } from '../../../../core/access/access.service.js';
import { TransactionalManager } from '../../../../core/database/transactional-manager.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { Public } from '../../../../core/http/decorators/public.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { TaskAttachmentsService } from '../../../attachments/application/task-attachments.service.js';
import { BugsService } from '../../../bugs/application/bugs.service.js';
import { parseCapture } from '../../../bugs/presentation/graphql/bugs.resolver.js';
import { ReportBugInput } from '../../../bugs/presentation/graphql/bugs.types.js';
import { SpacesService } from '../../../spaces/application/spaces.service.js';
import { ApiTokensService } from '../../application/api-tokens.service.js';
import type { ApiTokenOwner } from '../../domain/api-token.repository.js';
import { ApiTokenRepository } from '../../domain/api-token.repository.js';

export const EXTENSION_ROUTE = 'extension';

class ExchangeBody {
  @IsString() @Matches(/^[A-Za-z0-9._~-]{43,128}$/) verifier: string;
}

class UploadBody {
  @IsString() @IsNotEmpty() @MaxLength(255) fileName: string;
  @IsInt() @Min(1) @Max(TASK_UPLOAD_MAX_BYTES) size: number;
}

class SimilarQuery {
  @IsUUID('4') spaceId: string;
  @IsString() @MaxLength(200) title: string;
}

interface Connection {
  owner: ApiTokenOwner;
  actor: Actor;
  access: WorkspaceAccess;
}

/**
 * The browser extension's API. Public as far as the session guard goes because the extension has
 * no TaskFlow cookie: every route except the token pickup authenticates its own bearer token here,
 * fails closed, checks the token's scope and then the owner's current permissions (their role,
 * never a platform role), and runs in the owner's row-level security scope. Throttled per IP.
 */
@Public()
@Controller(EXTENSION_ROUTE)
export class ExtensionController {
  constructor(
    private readonly tokens: ApiTokensService,
    private readonly tokenRows: ApiTokenRepository,
    private readonly accessService: AccessService,
    private readonly transactional: TransactionalManager,
    private readonly bugs: BugsService,
    private readonly attachments: TaskAttachmentsService,
    private readonly spaces: SpacesService,
  ) {}

  /** Swaps the PKCE verifier for the token once the person approved the connection in TaskFlow. */
  @Post('token')
  @HttpCode(200)
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async token(@Body() body: ExchangeBody, @Req() request: Request): Promise<{ status: 'pending' } | { status: 'connected'; token: string; expiresAt: string }> {
    const issued = await this.tokens.exchange(body.verifier, request.ip ?? null);
    return issued ? { status: 'connected', token: issued.token, expiresAt: issued.record.expiresAt.toISOString() } : { status: 'pending' };
  }

  @Get('session')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async session(@Req() request: Request): Promise<ExtensionSessionResponse> {
    const connection = await this.connect(request, 'bugs:read', []);
    return this.inScope(connection, async () => {
      const projects = await this.spaces.list(connection.owner.workspaceId);
      return {
        user: { name: connection.owner.userName, email: connection.owner.userEmail },
        workspace: { id: connection.owner.workspaceId, name: (await this.tokenRows.workspaceName(connection.owner.workspaceId)) ?? 'Workspace' },
        projects: projects.map((space) => ({ id: space.id, name: space.name })),
        scopes: connection.owner.scopes,
        expiresAt: connection.owner.expiresAt.toISOString(),
      };
    });
  }

  @Get('bugs/similar')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async similar(@Query() query: SimilarQuery, @Req() request: Request): Promise<SimilarBugResponse[]> {
    const connection = await this.connect(request, 'bugs:read', ['task.view']);
    return this.inScope(connection, () => this.bugs.similar(connection.access, query.spaceId, query.title, null));
  }

  @Post('bugs')
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async report(@Body() input: ReportBugInput, @Req() request: Request): Promise<BugResponse & { url: string }> {
    const connection = await this.connect(request, 'bugs:write', ['task.create']);
    const { captureJson, ...rest } = input;
    const bug = await this.inScope(connection, () => this.bugs.report(connection.actor, connection.access, { ...rest, capture: parseCapture(captureJson) }, 'extension'), true);
    return { ...bug, url: `/w/${connection.owner.workspaceId}/p/${bug.spaceId}/bugs?task=${bug.taskId}` };
  }

  @Post('bugs/:taskId/uploads')
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async upload(@Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string, @Body() body: UploadBody, @Req() request: Request): Promise<TaskUploadTicket> {
    const connection = await this.connect(request, 'bugs:write', ['task.update']);
    return this.inScope(connection, async () => {
      // Only onto bug reports: a bugs:write token can't attach files to arbitrary tasks.
      await this.bugs.get(connection.access, taskId);
      return this.attachments.request(connection.actor, connection.access, { taskId, fileName: body.fileName, size: body.size });
    }, true);
  }

  @Post('uploads/:attachmentId/complete')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async complete(@Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string, @Req() request: Request): Promise<TaskUploadResult> {
    const connection = await this.connect(request, 'bugs:write', ['task.update']);
    return this.inScope(connection, () => this.attachments.complete(connection.actor, connection.access, attachmentId), true);
  }

  /** The extension signs out: its token stops working at once. */
  @Post('disconnect')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async disconnect(@Req() request: Request): Promise<void> {
    const owner = await this.owner(request);
    await this.tokens.revokeSelf(owner, request.ip ?? null);
  }

  private async owner(request: Request): Promise<ApiTokenOwner> {
    const header = request.headers.authorization ?? '';
    const match = /^Bearer (\S+)$/.exec(header);
    const owner = match ? await this.tokens.authenticate(match[1]!) : null;
    if (!owner) throw new UnauthorizedException();
    return owner;
  }

  private async connect(request: Request, scope: ApiTokenScope, permissions: readonly Permission[]): Promise<Connection> {
    const owner = await this.owner(request);
    if (!owner.scopes.includes(scope)) throw DomainError.forbidden(`This connection can't ${scope === 'bugs:write' ? 'file reports' : 'read reports'}`);
    // The owner's access today: removed from the workspace, or their role changed, counts at once.
    const access = await this.accessService.resolveMember(owner.userId, owner.workspaceId);
    if (!access) throw new UnauthorizedException();
    const missing = permissions.find((permission) => !access.permissions.has(permission));
    if (missing) throw DomainError.missingPermission(missing, null, 'Your role in this workspace doesn’t allow this');
    return { owner, access, actor: { userId: owner.userId, platformRole: 'USER', ip: request.ip ?? null } };
  }

  private inScope<T>(connection: Connection, work: () => Promise<T>, write = false): Promise<T> {
    const { workspaceId, spaceRules } = connection.access;
    return this.transactional.runInScope({ kind: 'workspace', workspaceId, userId: connection.owner.userId, ...(spaceRules.length ? { spaceRules } : {}) }, work, { readOnly: !write });
  }
}

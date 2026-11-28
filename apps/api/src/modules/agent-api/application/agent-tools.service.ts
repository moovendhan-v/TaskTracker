import { Injectable, Logger } from '@nestjs/common';
import { redactJson, type Permission } from '@taskflow/shared-types';
import { execute, parse, validate, type DocumentNode, type GraphQLError } from 'graphql';
import { AccessService } from '../../../core/access/access.service.js';
import { AgentContext } from '../../../core/agent/agent-context.js';
import { AGENT_REQUEST } from '../../../core/agent/agent-tool.decorator.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { SessionUser, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { ApiTokensService } from '../../api-tokens/application/api-tokens.service.js';
import type { ApiTokenOwner } from '../../api-tokens/domain/api-token.repository.js';
import { AgentToolCatalog, type AgentTool } from './agent-tool-catalog.js';

/** An authenticated AI agent: its token, owner and the owner's access today. */
export interface AgentConnection {
  owner: ApiTokenOwner;
  access: WorkspaceAccess;
  ip: string | null;
}

export type AgentProtocol = 'mcp' | 'utcp';

export type ToolOutcome = { ok: true; data: unknown } | { ok: false; error: string; code: string };

/** Before / after for a change: the thing the mutation's id argument names, read first. */
const BEFORE_GETTERS: Record<string, string> = { taskId: 'task', caseId: 'qaCase', planId: 'qaPlan', documentId: 'document', sprintId: 'sprint' };
const AUDIT_JSON_MAX = 4_000;

function compact(value: unknown): unknown {
  const json = JSON.stringify(redactJson(value) ?? null);
  return json.length <= AUDIT_JSON_MAX ? JSON.parse(json) : { truncated: true, preview: json.slice(0, AUDIT_JSON_MAX) };
}

/**
 * Runs AI agents' tool calls (MCP and UTCP alike) as real GraphQL operations of the API, as the
 * token's owner: the same resolvers, guards (permissions, space rules, two-step), validation and
 * throttling apply, and row-level security scopes the data. Read tokens see queries only; write
 * tokens also mutations. Changes are marked as the agent's in task history and comments, and every
 * call (read or write, success or failure) is audited with the agent, tool, resource, before/after
 * and outcome.
 */
@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);
  private readonly documents = new Map<string, DocumentNode>();

  constructor(
    private readonly catalog: AgentToolCatalog,
    private readonly tokens: ApiTokensService,
    private readonly accessService: AccessService,
    private readonly transactional: TransactionalManager,
    private readonly audit: AuditLogger,
  ) {}

  /** The agent behind a bearer token, or null (unknown, expired, revoked, not an agent token, or no longer a member). */
  async connect(authorization: string | undefined, ip: string | null): Promise<AgentConnection | null> {
    const match = /^Bearer (\S+)$/.exec(authorization ?? '');
    const owner = match ? await this.tokens.authenticate(match[1]!) : null;
    if (!owner || owner.client !== 'mcp' || !owner.scopes.includes('read')) return null;
    const access = await this.accessService.resolveMember(owner.userId, owner.workspaceId);
    return access ? { owner, access, ip } : null;
  }

  /** The tools this agent may call: by its token's scope and its owner's permissions today. */
  tools(connection: AgentConnection): AgentTool[] {
    const write = connection.owner.scopes.includes('write');
    return this.catalog.list().filter((tool) => (tool.kind === 'query' || write) && tool.permissions.every((permission: Permission) => connection.access.permissions.has(permission)));
  }

  async call(connection: AgentConnection, name: string, args: Record<string, unknown>, protocol: AgentProtocol): Promise<ToolOutcome> {
    const tool = this.tools(connection).find((item) => item.name === name);
    if (!tool) return this.finish(connection, name, null, args, protocol, { ok: false, error: `No tool named “${name}” is available to this connection`, code: 'UNKNOWN_TOOL' });
    const unknown = Object.keys(args).filter((key) => !tool.argNames.includes(key));
    if (unknown.length) return this.finish(connection, name, tool, args, protocol, { ok: false, error: `Unknown argument${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`, code: 'BAD_USER_INPUT' });

    const before = tool.kind === 'mutation' ? await this.before(connection, tool, args) : undefined;
    const outcome = await this.run(connection, tool, args);
    return this.finish(connection, name, tool, args, protocol, outcome, before);
  }

  private async run(connection: AgentConnection, tool: AgentTool, args: Record<string, unknown>): Promise<ToolOutcome> {
    const { owner } = connection;
    const schema = this.catalog.schema();
    let document = this.documents.get(tool.name);
    if (!document) {
      document = parse(tool.document);
      const problems = validate(schema, document);
      if (problems.length) {
        this.logger.error(`Agent tool ${tool.name} has an invalid document: ${problems[0]!.message}`);
        return { ok: false, error: 'This tool is not available right now', code: 'INTERNAL' };
      }
      this.documents.set(tool.name, document);
    }
    // A request of our own: the token's owner, never with a platform role, marked for the session guard.
    const user: SessionUser = { id: owner.userId, email: owner.userEmail, name: owner.userName, image: null, platformRole: 'USER', emailVerified: true };
    const request = { user, headers: {}, ip: connection.ip ?? undefined, method: 'POST', url: '/api/agent', [AGENT_REQUEST]: true };
    const response = { header: () => undefined, setHeader: () => undefined, getHeader: () => undefined };
    try {
      const result = await AgentContext.run({ name: owner.name, tokenId: owner.id }, async () =>
        execute({ schema, document, variableValues: { ...args, workspaceId: owner.workspaceId }, contextValue: { req: request, res: response } }),
      );
      if (result.errors?.length) {
        const [error] = result.errors as readonly GraphQLError[];
        return { ok: false, error: error!.message, code: String(error!.extensions?.['code'] ?? 'ERROR') };
      }
      return { ok: true, data: result.data?.[tool.name] ?? null };
    } catch (error) {
      this.logger.error(`Agent tool ${tool.name} failed`, error instanceof Error ? error.stack : undefined);
      return { ok: false, error: 'Internal error', code: 'INTERNAL' };
    }
  }

  private async before(connection: AgentConnection, tool: AgentTool, args: Record<string, unknown>): Promise<unknown> {
    for (const [arg, getterName] of Object.entries(BEFORE_GETTERS)) {
      if (typeof args[arg] !== 'string') continue;
      const getter = this.catalog.get(getterName);
      if (!getter || getter.kind !== 'query' || !getter.argNames.includes(arg)) continue;
      const outcome = await this.run(connection, getter, { [arg]: args[arg] });
      return outcome.ok ? outcome.data : undefined;
    }
    return undefined;
  }

  /** Audits the call in its own transaction (so a failed call is recorded too), then returns its outcome. */
  private async finish(connection: AgentConnection, name: string, tool: AgentTool | null, args: Record<string, unknown>, protocol: AgentProtocol, outcome: ToolOutcome, before?: unknown): Promise<ToolOutcome> {
    const { owner } = connection;
    const resource = Object.fromEntries(Object.entries(args).filter(([key, value]) => /Id$/.test(key) && typeof value === 'string'));
    try {
      await this.transactional.runInScope({ kind: 'workspace', workspaceId: owner.workspaceId, userId: owner.userId }, () =>
        this.audit.record(
          { userId: owner.userId, platformRole: 'USER', ip: connection.ip },
          {
            action: `agent.${name}`.slice(0, 80),
            targetType: 'agent_tool',
            targetId: (Object.values(resource)[0] as string | undefined) ?? null,
            workspaceId: owner.workspaceId,
            metadata: {
              agent: owner.name,
              tokenId: owner.id,
              protocol,
              tool: name,
              kind: tool?.kind ?? null,
              resource,
              arguments: compact(args),
              ...(before !== undefined ? { before: compact(before) } : {}),
              ...(outcome.ok && tool?.kind === 'mutation' ? { after: compact(outcome.data) } : {}),
              outcome: outcome.ok ? 'ok' : 'error',
              ...(outcome.ok ? {} : { error: outcome.error, code: outcome.code }),
            },
          },
        ),
      );
    } catch (error) {
      // The call itself already ran (a change may be committed), so its real outcome is returned rather than
      // inviting a retry; the missing audit entry is an alert for operators.
      this.logger.error(`AUDIT MISSING for agent call ${name} (token ${owner.id})`, error instanceof Error ? error.stack : undefined);
    }
    return outcome;
  }
}

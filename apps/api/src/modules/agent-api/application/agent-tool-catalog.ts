import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, ModuleRef } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { PERMISSIONS, type Permission } from '@taskflow/shared-types';
import {
  getNamedType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  isInterfaceType,
  isUnionType,
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLInputType,
  type GraphQLOutputType,
  type GraphQLSchema,
} from 'graphql';
import { AGENT_TOOL_KEY } from '../../../core/agent/agent-tool.decorator.js';
import { REQUIRED_PERMISSIONS_KEY } from '../../../core/access/require-permissions.decorator.js';
import { REQUIRES_PLATFORM_ADMIN_KEY } from '../../../core/access/require-platform-admin.decorator.js';

const RESOLVER_TYPE = 'graphql:resolver_type';
const RESOLVER_NAME = 'graphql:resolver_name';

/**
 * Permissions an AI agent may use on its owner's behalf. Administration (workspace, members,
 * roles, policies, integrations, HR, audit) stays with people.
 */
export const AGENT_PERMISSIONS: readonly Permission[] = (['task.view', 'task.create', 'task.update', 'task.assign', 'doc.view', 'doc.create', 'time.log', 'sprint.manage'] as const).filter((permission) =>
  (PERMISSIONS as readonly string[]).includes(permission),
);

/** Destructive or irreversible operations are never offered: a person does those in TaskFlow. */
const DESTRUCTIVE = /^(delete|remove|revoke|rotate|leave|archive|purge|reset|transfer|disconnect|uninstall|cancel|clear)/i;
/** Sign-in, keys and connections: never through an agent, even when membership is enough. */
const SENSITIVE =
  /apiToken|extensionConnection|password|twoFactor|twoStep|passkey|session|sso|signIn|webhook|integration|aiSettings|organization|bugIntake|bugShare|github|^roles$|myAccess|explainMyAccess|protectedFields|clockIn|clockOut|Break$/i;
/** Attendance (clock in/out, breaks) and security settings stay with the person. */

export type JsonSchema = Record<string, unknown>;

export interface AgentTool {
  /** The GraphQL field, also the tool's name. */
  name: string;
  title: string;
  description: string;
  kind: 'query' | 'mutation';
  permissions: Permission[];
  inputSchema: JsonSchema;
  /** Argument names the caller may send (workspaceId is filled in from the token). */
  argNames: string[];
  /** The GraphQL document run for a call. */
  document: string;
}

const humanize = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase());

/**
 * Every workspace operation of the GraphQL API, as tools for AI agents (MCP and UTCP), found at
 * startup, so a new feature's queries and mutations become tools without extra code. Offered when:
 * it takes a workspaceId; it isn't platform-admin only; every permission it needs is in
 * AGENT_PERMISSIONS; it isn't destructive or security-related; and a membership-only mutation is
 * marked @AgentTool(true). @AgentTool(false) hides any operation.
 */
@Injectable()
export class AgentToolCatalog implements OnApplicationBootstrap {
  private readonly logger = new Logger(AgentToolCatalog.name);
  private tools = new Map<string, AgentTool>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** The built schema, from the GraphQL module (it isn't exported for injection). */
  schema(): GraphQLSchema {
    return this.moduleRef.get(GraphQLSchemaHost, { strict: false }).schema;
  }

  onApplicationBootstrap(): void {
    this.build();
  }

  list(): AgentTool[] {
    if (!this.tools.size) this.build();
    return [...this.tools.values()];
  }

  get(name: string): AgentTool | null {
    if (!this.tools.size) this.build();
    return this.tools.get(name) ?? null;
  }

  private build(): void {
    const schema = this.schema();
    const tools = new Map<string, AgentTool>();
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as object | undefined;
      if (!instance || typeof instance !== 'object') continue;
      const prototype = Object.getPrototypeOf(instance) as object;
      for (const method of this.scanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, unknown>)[method] as object;
        const type = Reflect.getMetadata(RESOLVER_TYPE, handler) as string | undefined;
        if (type !== 'Query' && type !== 'Mutation') continue;
        const name = (Reflect.getMetadata(RESOLVER_NAME, handler) as string | undefined) ?? method;
        const offered = Reflect.getMetadata(AGENT_TOOL_KEY, handler) as boolean | undefined;
        if (offered === false || Reflect.getMetadata(REQUIRES_PLATFORM_ADMIN_KEY, handler) === true) continue;
        const permissions = (Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler) as Permission[] | undefined) ?? (Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, instance.constructor) as Permission[] | undefined);
        if (!permissions) continue; // No workspace guard: not a workspace operation.
        if (permissions.some((permission) => !AGENT_PERMISSIONS.includes(permission))) continue;
        if (DESTRUCTIVE.test(name) || SENSITIVE.test(name)) continue;
        if (type === 'Mutation' && permissions.length === 0 && offered !== true) continue;
        const field = (type === 'Query' ? schema.getQueryType() : schema.getMutationType())?.getFields()[name];
        if (!field || !field.args.some((arg) => arg.name === 'workspaceId')) continue;
        tools.set(name, this.tool(name, type === 'Query' ? 'query' : 'mutation', permissions, field));
      }
    }
    this.tools = new Map([...tools.entries()].sort(([a], [b]) => a.localeCompare(b)));
    this.logger.log(`${this.tools.size} GraphQL operations offered to AI agents`);
  }

  private tool(name: string, kind: 'query' | 'mutation', permissions: Permission[], field: GraphQLField<unknown, unknown>): AgentTool {
    const args = field.args.filter((arg) => arg.name !== 'workspaceId');
    const properties: Record<string, JsonSchema> = {};
    for (const arg of args) properties[arg.name] = { ...inputSchema(arg.type, 0), ...(arg.description ? { description: arg.description } : {}) };
    const required = args.filter((arg) => arg.type instanceof GraphQLNonNull && arg.defaultValue === undefined).map((arg) => arg.name);
    const variables = field.args.map((arg: GraphQLArgument) => `$${arg.name}: ${String(arg.type)}`).join(', ');
    const call = field.args.map((arg) => `${arg.name}: $${arg.name}`).join(', ');
    const selection = selectionFor(field.type, 0);
    return {
      name,
      title: humanize(name),
      description: [field.description ?? humanize(name), kind === 'query' ? 'Reads only.' : 'Changes data, as you; recorded as the AI agent’s change.'].join(' '),
      kind,
      permissions,
      inputSchema: { type: 'object', properties, required, additionalProperties: false },
      argNames: args.map((arg) => arg.name),
      document: `${kind} AgentTool(${variables}) { ${name}(${call})${selection ? ` ${selection}` : ''} }`,
    };
  }
}

/** JSON Schema for a GraphQL input type (what the tool's caller sends). */
function inputSchema(type: GraphQLInputType, depth: number): JsonSchema {
  if (type instanceof GraphQLNonNull) return inputSchema(type.ofType, depth);
  if (type instanceof GraphQLList) return { type: 'array', items: inputSchema(type.ofType, depth) };
  if (type instanceof GraphQLEnumType) return { type: 'string', enum: type.getValues().map((value) => value.name) };
  if (type instanceof GraphQLInputObjectType) {
    if (depth > 5) return { type: 'object' };
    const fields = Object.values(type.getFields());
    return {
      type: 'object',
      ...(type.description ? { description: type.description } : {}),
      properties: Object.fromEntries(fields.map((item) => [item.name, { ...inputSchema(item.type, depth + 1), ...(item.description ? { description: item.description } : {}) }])),
      required: fields.filter((item) => item.type instanceof GraphQLNonNull && item.defaultValue === undefined).map((item) => item.name),
      additionalProperties: false,
    };
  }
  const scalar = (type as GraphQLScalarType).name;
  if (scalar === 'Int') return { type: 'integer' };
  if (scalar === 'Float') return { type: 'number' };
  if (scalar === 'Boolean') return { type: 'boolean' };
  if (scalar === 'ID') return { type: 'string', description: 'An id' };
  if (scalar === 'String') return { type: 'string' };
  return {};
}

const MAX_FIELDS = 40;

/** The fields a call returns: plain fields two levels deep (fields that take arguments are left out). */
function selectionFor(type: GraphQLOutputType, depth: number): string {
  const named = getNamedType(type);
  if (isUnionType(named) || isInterfaceType(named)) return '{ __typename }';
  if (!(named instanceof GraphQLObjectType)) return '';
  const parts: string[] = [];
  for (const field of Object.values(named.getFields())) {
    if (parts.length >= MAX_FIELDS) break;
    if (field.args.length) continue;
    const inner = getNamedType(field.type);
    if (inner instanceof GraphQLObjectType || isUnionType(inner) || isInterfaceType(inner)) {
      if (depth >= 1) continue;
      const nested = selectionFor(field.type, depth + 1);
      if (nested) parts.push(`${field.name} ${nested}`);
    } else {
      parts.push(field.name);
    }
  }
  return parts.length ? `{ ${parts.join(' ')} }` : '{ __typename }';
}

import { SetMetadata } from '@nestjs/common';

export const AGENT_TOOL_KEY = 'agentTool';

/**
 * Overrides whether a GraphQL operation is offered to AI agents (MCP / UTCP, E6.5). By default
 * every workspace query and mutation is, when its permissions are ones an agent may use and it
 * isn't destructive or security-related (see AgentToolCatalog). `true` offers a membership-only
 * mutation; `false` never offers the operation.
 */
export const AgentTool = (offered: boolean): MethodDecorator => SetMetadata(AGENT_TOOL_KEY, offered);

/** Marks a request the agent API built itself (never set from HTTP input): its user is already authenticated by an API token. */
export const AGENT_REQUEST = Symbol('agentRequest');

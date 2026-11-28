import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { AgentToolCatalog } from './application/agent-tool-catalog.js';
import { AgentToolsService } from './application/agent-tools.service.js';
import { AgentApiController } from './presentation/http/agent-api.controller.js';

/** E6.5 the agent API: the GraphQL API as tools for AI agents, over MCP and UTCP. */
@Module({
  imports: [DiscoveryModule, ApiTokensModule],
  controllers: [AgentApiController],
  providers: [AgentToolCatalog, AgentToolsService],
})
export class AgentApiModule {}

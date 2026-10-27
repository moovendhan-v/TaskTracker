import { Module } from '@nestjs/common';
import { AutomationsModule } from '../automations/automations.module.js';
import { StatusesModule } from '../statuses/statuses.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { GithubConnectionsService } from './application/github-connections.service.js';
import { GithubWebhookService } from './application/github-webhook.service.js';
import { GithubRepository } from './domain/github.repository.js';
import { TypeOrmGithubRepository } from './infrastructure/typeorm-github.repository.js';
import { GithubResolver } from './presentation/graphql/github.resolver.js';
import { GithubWebhookController } from './presentation/http/github-webhook.controller.js';

@Module({
  imports: [TasksModule, StatusesModule, AutomationsModule],
  controllers: [GithubWebhookController],
  providers: [GithubConnectionsService, GithubWebhookService, GithubResolver, { provide: GithubRepository, useClass: TypeOrmGithubRepository }],
})
export class IntegrationsModule {}

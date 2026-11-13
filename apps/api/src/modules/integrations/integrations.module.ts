import { Module } from '@nestjs/common';
import { AutomationsModule } from '../automations/automations.module.js';
import { StatusesModule } from '../statuses/statuses.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { GithubAppSync } from './application/github-app-sync.js';
import { GithubAppService } from './application/github-app.service.js';
import { GithubConnectionsService } from './application/github-connections.service.js';
import { GithubWebhookService } from './application/github-webhook.service.js';
import { GithubAppRepository } from './domain/github-app.repository.js';
import { GithubRepository } from './domain/github.repository.js';
import { TypeOrmGithubAppRepository } from './infrastructure/typeorm-github-app.repository.js';
import { TypeOrmGithubRepository } from './infrastructure/typeorm-github.repository.js';
import { GithubAppResolver } from './presentation/graphql/github-app.resolver.js';
import { GithubResolver } from './presentation/graphql/github.resolver.js';
import { GithubAppCallbackController } from './presentation/http/github-app-callback.controller.js';
import { GithubWebhookController } from './presentation/http/github-webhook.controller.js';

@Module({
  imports: [TasksModule, StatusesModule, AutomationsModule],
  controllers: [GithubWebhookController, GithubAppCallbackController],
  providers: [
    GithubConnectionsService,
    GithubWebhookService,
    GithubResolver,
    GithubAppService,
    GithubAppSync,
    GithubAppResolver,
    { provide: GithubRepository, useClass: TypeOrmGithubRepository },
    { provide: GithubAppRepository, useClass: TypeOrmGithubAppRepository },
  ],
})
export class IntegrationsModule {}

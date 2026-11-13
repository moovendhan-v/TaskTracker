import { DEFAULT_GITHUB_SYNC, type GithubConnectionResponse, type PullRequestLinkResponse } from '@taskflow/shared-types';
import { API_PREFIX } from '../../../bootstrap/api-prefix.js';
import type { GithubConnection, PullRequestLink } from '../domain/github.js';

export const GITHUB_WEBHOOK_ROUTE = 'integrations/github/webhook';

export const GithubMapper = {
  toResponse(connection: GithubConnection): GithubConnectionResponse {
    return {
      id: connection.id,
      repo: connection.repo,
      taskPrefix: connection.taskPrefix,
      sync: { ...DEFAULT_GITHUB_SYNC, ...connection.sync },
      webhookPath: `/${API_PREFIX}/${GITHUB_WEBHOOK_ROUTE}/${connection.id}`,
      createdById: connection.createdById,
      lastDeliveryAt: connection.lastDeliveryAt?.toISOString() ?? null,
      lastDeliveryStatus: connection.lastDeliveryStatus,
      viaApp: connection.installationRef !== null,
      createdAt: connection.createdAt.toISOString(),
    };
  },

  toLinkResponse(link: PullRequestLink): PullRequestLinkResponse {
    return {
      id: link.id,
      taskId: link.taskId,
      repo: link.repo,
      number: link.number,
      title: link.title,
      url: link.url,
      state: link.state,
      author: link.author,
      branch: link.branch,
      updatedAt: link.updatedAt.toISOString(),
    };
  },
};

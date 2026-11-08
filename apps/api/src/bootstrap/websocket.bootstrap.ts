import type { Server } from 'node:http';
import type { Duplex } from 'node:stream';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX, LIVE_DOCS_PATH } from './api-prefix.js';

const GRAPHQL_SOCKET_PATH = `/${API_PREFIX}/graphql`;

/**
 * The GraphQL subscription server answers upgrades on /api/graphql and the live docs
 * gateway on /api/docs/live; both leave any other upgrade request hanging. Close those
 * sockets straight away.
 */
export function rejectStrayUpgrades(app: NestExpressApplication): void {
  const server = app.getHttpServer() as Server;
  server.on('upgrade', (request: { url?: string }, socket: Duplex) => {
    const path = request.url?.split('?')[0];
    if (path !== GRAPHQL_SOCKET_PATH && path !== LIVE_DOCS_PATH) socket.destroy();
  });
}

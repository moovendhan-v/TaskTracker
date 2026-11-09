import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { API_PREFIX } from './api-prefix.js';

/** GitHub's pull request payloads are well under this; larger bodies are refused before any work. */
const WEBHOOK_BODY_LIMIT = 2 * 1024 * 1024;

/**
 * Webhooks are verified against their exact bytes, so their bodies are read raw
 * (a Buffer, size-limited) before the JSON parser could touch them. Only JSON is accepted.
 */
export function mountWebhookParsers(app: NestExpressApplication): void {
  app.getHttpAdapter().getInstance().use(`/${API_PREFIX}/integrations`, readRawBody);
}

function readRawBody(request: Request, response: Response, next: NextFunction): void {
  if (request.method !== 'POST') return next();
  // LiveKit sends application/webhook+json.
  const type = (request.headers['content-type'] ?? '').toLowerCase();
  if (!type.startsWith('application/json') && !type.startsWith('application/webhook+json')) {
    response.status(415).json({ message: 'Send webhooks as application/json' });
    return;
  }
  if (Number(request.headers['content-length'] ?? 0) > WEBHOOK_BODY_LIMIT) {
    response.status(413).json({ message: 'Payload too large' });
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let done = false;
  request.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > WEBHOOK_BODY_LIMIT && !done) {
      done = true;
      response.status(413).json({ message: 'Payload too large' });
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => {
    if (done) return;
    done = true;
    // Marks the body as read, so later parsers leave it alone.
    (request as Request & { _body?: boolean }).body = Buffer.concat(chunks);
    (request as Request & { _body?: boolean })._body = true;
    next();
  });
  request.on('error', (error) => {
    if (done) return;
    done = true;
    next(error);
  });
}

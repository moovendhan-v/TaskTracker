import { Controller, Get, HttpCode, Inject, Param, Put, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Transform } from 'node:stream';
import { Public } from '../http/decorators/public.decorator.js';
import { FileStorage } from './file-storage.port.js';
import { StorageTokens } from './storage-tokens.js';

const refuse = (response: Response, status: number, message: string) => response.status(status).json({ message });

/**
 * Upload and download URLs for stored files. The routes are public because the
 * signed token in the path is the permission: the API hands one out only after
 * its own access checks, it is bound to one file and expires within minutes.
 * Files never leave a private bucket any other way.
 */
@Controller('storage')
export class StorageController {
  constructor(
    @Inject(FileStorage) private readonly storage: FileStorage,
    private readonly tokens: StorageTokens,
  ) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Put('uploads/:token')
  @HttpCode(204)
  async upload(@Param('token') token: string, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const grant = this.tokens.verify(token);
    if (!grant || grant.op !== 'put') return void refuse(response, 403, 'This upload link is invalid or has expired');
    const declared = Number(request.headers['content-length']);
    if (!Number.isFinite(declared) || declared <= 0) return void refuse(response, 411, 'Content-Length is required');
    if (declared > grant.max) return void refuse(response, 413, 'File is too large');
    // Single use: once bytes are stored (and possibly checked and sent), the link can't replace them.
    if ((await this.storage.size(grant.key)) !== null) return void refuse(response, 409, 'This upload link was already used');

    let seen = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        seen += chunk.length;
        if (seen > grant.max) return done(new Error('File is too large'));
        done(null, chunk);
      },
    });
    try {
      await this.storage.put(grant.key, request.pipe(limit), 'application/octet-stream');
    } catch {
      await this.storage.delete(grant.key).catch(() => undefined);
      return void refuse(response, 400, "The upload didn't complete");
    }
  }

  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Get('files/:token')
  async download(@Param('token') token: string, @Res() response: Response): Promise<void> {
    const grant = this.tokens.verify(token);
    if (!grant || grant.op !== 'get') return void refuse(response, 403, 'This link is invalid or has expired');
    const found = await this.storage
      .size(grant.key)
      .then(async (size) => (size === null ? null : { size, body: await this.storage.read(grant.key) }))
      .catch(() => null);
    if (!found) return void refuse(response, 404, 'File not found');
    const { size, body } = found;
    response.setHeader('Content-Type', grant.type);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    // Even if a file were misdetected, it can't run script or load anything in this origin.
    response.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    response.setHeader('Content-Disposition', `${grant.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(grant.name)}`);
    response.setHeader('Content-Length', String(size));
    response.setHeader('Cache-Control', 'private, max-age=300');
    body.on('error', () => response.destroy());
    body.pipe(response);
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Md2SlidesCatalogResponse } from '@taskflow/shared-types';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { Clock } from '../../../core/time/clock.port.js';
import { isUsable, MD2SLIDES_FILES, parseCommunity, parseSnippets, parseSyntax, type Md2SlidesCatalog } from './md2slides-catalog.js';
import { MD2SLIDES_SNAPSHOT } from './md2slides-snapshot.generated.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** After a failed read, the snapshot is served and md2slides is asked again this much later. */
const RETRY_MS = 60 * 60 * 1000;
const BODY_MAX = 2_000_000;

interface Loaded {
  catalog: Md2SlidesCatalog;
  source: 'live' | 'snapshot';
  at: Date;
  nextReadAt: number;
}

/**
 * md2slides' community templates, contributors, snippets and syntax guide, read from the
 * md2slides project itself (MD2SLIDES_SOURCE_URL, a fixed trusted host) at most once a day,
 * so new contributions appear without a TaskFlow release. Falls back to the bundled snapshot
 * (scripts/sync-md2slides.mjs) when md2slides can't be reached, so it never fails a request.
 */
@Injectable()
export class Md2SlidesService {
  private readonly logger = new Logger(Md2SlidesService.name);
  private loaded: Loaded | null = null;
  private reading: Promise<Loaded> | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly clock: Clock,
  ) {}

  async catalog(): Promise<Md2SlidesCatalog & Pick<Md2SlidesCatalogResponse, 'source' | 'updatedAt'>> {
    const now = this.clock.now().getTime();
    if (!this.loaded || now >= this.loaded.nextReadAt) {
      this.reading ??= this.read().finally(() => (this.reading = null));
      this.loaded = await this.reading;
    }
    return { ...this.loaded.catalog, source: this.loaded.source, updatedAt: this.loaded.at.toISOString() };
  }

  private async read(): Promise<Loaded> {
    const now = this.clock.now();
    const base = this.env.MD2SLIDES_SOURCE_URL;
    if (base) {
      try {
        const [community, snippets, syntax] = await Promise.all([this.fetch(base, MD2SLIDES_FILES.community, 'json'), this.fetch(base, MD2SLIDES_FILES.snippets, 'json'), this.fetch(base, MD2SLIDES_FILES.syntax, 'text')]);
        const catalog: Md2SlidesCatalog = { ...parseCommunity(community), snippets: parseSnippets(snippets), syntax: parseSyntax(syntax) };
        if (isUsable(catalog)) return { catalog, source: 'live', at: now, nextReadAt: now.getTime() + DAY_MS };
        this.logger.warn('md2slides answered with an unusable catalog; using the bundled snapshot');
      } catch (error) {
        this.logger.warn(`md2slides could not be read (${error instanceof Error ? error.message : 'unknown error'}); using the bundled snapshot`);
      }
    }
    return { catalog: snapshot(), source: 'snapshot', at: new Date(MD2SLIDES_SNAPSHOT.syncedAt), nextReadAt: now.getTime() + (base ? RETRY_MS : DAY_MS * 3650) };
  }

  /** One file from md2slides: a fixed path under a configured https host, with a timeout and a size cap. */
  private async fetch(base: string, path: string, kind: 'json' | 'text'): Promise<unknown> {
    const response = await fetch(`${base.replace(/\/+$/, '')}/${path}`, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const body = await response.text();
    if (body.length > BODY_MAX) throw new Error(`${path}: too large`);
    return kind === 'json' ? JSON.parse(body) : body;
  }
}

function snapshot(): Md2SlidesCatalog {
  return { ...parseCommunity(MD2SLIDES_SNAPSHOT.community), snippets: parseSnippets(MD2SLIDES_SNAPSHOT.snippets), syntax: parseSyntax(MD2SLIDES_SNAPSHOT.syntax) };
}

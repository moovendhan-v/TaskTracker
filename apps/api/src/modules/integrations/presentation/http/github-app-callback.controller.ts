import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from '../../../../core/auth/auth.service.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { Public } from '../../../../core/http/decorators/public.decorator.js';
import { GithubAppService } from '../../application/github-app.service.js';

export const GITHUB_APP_CALLBACK_ROUTE = 'integrations/github/app-callback';

/**
 * Where GitHub sends a person back after they install (or change) the TaskFlow GitHub App.
 * Redirects only to TaskFlow's own pages (relative paths), with a short result code.
 */
@Controller(GITHUB_APP_CALLBACK_ROUTE)
export class GithubAppCallbackController {
  private readonly logger = new Logger(GithubAppCallbackController.name);

  constructor(
    private readonly apps: GithubAppService,
    private readonly authService: AuthService,
  ) {}

  // Public so a signed-out browser is sent to sign in instead of getting a bare 401. The session
  // is checked below, and the signed state must belong to that person.
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get()
  async callback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('installation_id') installationId: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = await this.authService.getSessionUser(request.headers).catch(() => null);
    if (!user) return response.redirect(303, '/sign-in');
    // Changing an existing installation on GitHub sends people here without our state.
    if (!state) return response.redirect(303, '/?github=updated');
    // Back to that workspace's settings when the link is this person's own; otherwise to the start page.
    const workspaceId = this.apps.installWorkspace(user, String(state));
    const back = (result: string) => response.redirect(303, workspaceId ? `/w/${workspaceId}/settings?github=${result}` : `/?github=${result}`);
    if (!code || !installationId) return back('incomplete');
    try {
      await this.apps.finishInstall(user, { state: String(state), code: String(code), installationId: String(installationId) });
      return back('installed');
    } catch (error) {
      if (!(error instanceof DomainError)) this.logger.error('GitHub App install failed', error instanceof Error ? error.stack : undefined);
      return back(error instanceof DomainError && error.kind === 'forbidden' ? 'not-yours' : 'failed');
    }
  }
}

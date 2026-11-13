import { Global, Module } from '@nestjs/common';
import { GithubAppClient } from './github-app.client.js';

/** The TaskFlow GitHub App (E2), for any module that syncs with GitHub. */
@Global()
@Module({ providers: [GithubAppClient], exports: [GithubAppClient] })
export class GithubAppModule {}

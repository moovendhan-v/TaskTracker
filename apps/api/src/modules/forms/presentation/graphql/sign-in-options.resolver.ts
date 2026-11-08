import { Inject } from '@nestjs/common';
import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { ENV } from '../../../../config/config.module.js';
import type { Env } from '../../../../config/env.schema.js';
import { Public } from '../../../../core/http/decorators/public.decorator.js';

@ObjectType('SignInOptions', { description: 'Which ways of signing in this server offers' })
export class SignInOptionsGql {
  @Field({ description: 'Sign in with GitHub is configured' })
  github!: boolean;
}

@Resolver(() => SignInOptionsGql)
export class SignInOptionsResolver {
  constructor(@Inject(ENV) private readonly env: Env) {}

  // Public: the sign-in page asks before anyone is signed in. It says only whether a provider is
  // switched on (never its keys), and the global rate limit applies.
  @Public()
  @Query(() => SignInOptionsGql, { description: 'Which ways of signing in this server offers' })
  signInOptions(): SignInOptionsGql {
    return { github: Boolean(this.env.GITHUB_CLIENT_ID && this.env.GITHUB_CLIENT_SECRET) };
  }
}

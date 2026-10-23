import { Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../../../core/http/decorators/current-user.decorator.js';
import type { SessionUser } from '../../../../core/http/types/authenticated-request.js';
import { CurrentUserGql } from './user.types.js';

@Resolver(() => CurrentUserGql)
export class MeResolver {
  @Query(() => CurrentUserGql, { description: 'The signed-in user' })
  me(@CurrentUser() user: SessionUser): CurrentUserGql {
    const { id, name, email, image, platformRole, emailVerified } = user;
    return { id, name, email, image, platformRole, emailVerified };
  }
}

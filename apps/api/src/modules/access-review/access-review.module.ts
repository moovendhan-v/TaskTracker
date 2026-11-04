import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { AccessReviewService } from './application/access-review.service.js';
import { AccessReviewResolver } from './presentation/graphql/access-review.resolver.js';

/** E3: explaining access decisions, and asking for access. */
@Module({
  imports: [MembersModule, RolesModule, SpacesModule, NotificationsModule],
  providers: [AccessReviewService, AccessReviewResolver],
})
export class AccessReviewModule {}

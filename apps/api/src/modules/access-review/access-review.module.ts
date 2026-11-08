import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { AccessReviewService } from './application/access-review.service.js';
import { AccessGrantRepository } from './domain/access-grant.repository.js';
import { TypeOrmAccessGrantRepository } from './infrastructure/typeorm-access-grant.repository.js';
import { AccessReviewResolver } from './presentation/graphql/access-review.resolver.js';

/** E3: explaining access decisions, asking for access, and approving it as time-limited grants. */
@Module({
  imports: [MembersModule, RolesModule, SpacesModule, NotificationsModule],
  providers: [AccessReviewService, AccessReviewResolver, { provide: AccessGrantRepository, useClass: TypeOrmAccessGrantRepository }],
})
export class AccessReviewModule {}

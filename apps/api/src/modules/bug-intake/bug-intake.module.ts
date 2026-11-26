import { Module } from '@nestjs/common';
import { CaptchaVerifier } from '../../core/captcha/captcha-verifier.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { BugsModule } from '../bugs/bugs.module.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { BugIntakeService } from './application/bug-intake.service.js';
import { BugSharesService } from './application/bug-shares.service.js';
import { IntakeRepository } from './domain/intake.repository.js';
import { TypeOrmIntakeRepository } from './infrastructure/typeorm-intake.repository.js';
import { BugIntakeResolver } from './presentation/graphql/bug-intake.resolver.js';
import { PublicFeedbackController } from './presentation/http/public-feedback.controller.js';

/** E6.3 public feedback (widget and portal) and read-only report links. */
@Module({
  imports: [BugsModule, AttachmentsModule, SpacesModule],
  controllers: [PublicFeedbackController],
  providers: [BugIntakeService, BugSharesService, BugIntakeResolver, CaptchaVerifier, { provide: IntakeRepository, useClass: TypeOrmIntakeRepository }],
})
export class BugIntakeModule {}

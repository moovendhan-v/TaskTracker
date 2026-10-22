import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module.js';
import { SprintsService } from './application/sprints.service.js';
import { SprintRepository } from './domain/sprint.repository.js';
import { TypeOrmSprintRepository } from './infrastructure/typeorm-sprint.repository.js';
import { SprintsController } from './presentation/sprints.controller.js';

@Module({
  imports: [SpacesModule],
  controllers: [SprintsController],
  providers: [SprintsService, { provide: SprintRepository, useClass: TypeOrmSprintRepository }],
  exports: [SprintsService],
})
export class SprintsModule {}

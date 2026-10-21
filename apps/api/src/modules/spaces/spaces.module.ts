import { Module } from '@nestjs/common';
import { SpacesService } from './application/spaces.service.js';
import { SpaceRepository } from './domain/space.repository.js';
import { TypeOrmSpaceRepository } from './infrastructure/typeorm-space.repository.js';
import { SpacesController } from './presentation/spaces.controller.js';

@Module({
  controllers: [SpacesController],
  providers: [SpacesService, { provide: SpaceRepository, useClass: TypeOrmSpaceRepository }],
  exports: [SpacesService],
})
export class SpacesModule {}

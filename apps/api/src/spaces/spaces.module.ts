import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceEntity } from './entities/space.entity.js';
import { SpacesController } from './spaces.controller.js';
import { SpacesService } from './spaces.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SpaceEntity])],
  controllers: [SpacesController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}

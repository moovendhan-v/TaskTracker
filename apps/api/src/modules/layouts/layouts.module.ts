import { Module } from '@nestjs/common';
import { LayoutsService } from './application/layouts.service.js';
import { LayoutRepository } from './domain/layout.repository.js';
import { TypeOrmLayoutRepository } from './infrastructure/typeorm-layout.repository.js';
import { LayoutsResolver } from './presentation/graphql/layouts.resolver.js';

/** Personal, arrangeable page layouts (the v2 block grid). */
@Module({
  providers: [LayoutsService, LayoutsResolver, { provide: LayoutRepository, useClass: TypeOrmLayoutRepository }],
})
export class LayoutsModule {}

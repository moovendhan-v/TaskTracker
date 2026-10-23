import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewSpace, Space } from '../domain/space.js';
import { SpaceRepository } from '../domain/space.repository.js';
import { SpaceOrmEntity } from './space.orm-entity.js';

@Injectable()
export class TypeOrmSpaceRepository extends SpaceRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(SpaceOrmEntity);
  }

  listByWorkspace(workspaceId: string): Promise<Space[]> {
    return this.repository.find({ where: { workspaceId }, order: { createdAt: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, spaceId: string): Promise<Space | null> {
    return this.repository.findOneBy({ id: spaceId, workspaceId });
  }

  create(space: NewSpace): Promise<Space> {
    return this.repository.save(this.repository.create(space));
  }

  save(space: Space): Promise<Space> {
    return this.repository.save(this.repository.create(space));
  }

  async delete(workspaceId: string, spaceId: string): Promise<void> {
    await this.repository.delete({ id: spaceId, workspaceId });
  }
}

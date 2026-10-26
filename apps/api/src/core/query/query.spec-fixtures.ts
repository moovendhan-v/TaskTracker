import { QueryField, QueryResource } from './query-resource.decorators.js';

/** A small resource used by the query specs. */
@QueryResource({
  name: 'spec_things',
  label: 'Things',
  permission: 'task.view',
  idColumn: 't.id',
  defaultSort: [{ field: 'name', direction: 'asc' }],
  maxPageSize: 50,
  logic: ['and', 'or', 'not'],
  search: ['t.name'],
})
export class SpecThings {
  @QueryField({ type: 'string', column: 't.name', sortable: true })
  name: string;

  @QueryField({ type: 'enum', column: 't.status', options: ['open', 'closed'] })
  status: string;

  @QueryField({ type: 'number', column: 't.points', sortable: true })
  points: number;

  @QueryField({ type: 'user', column: 't.owner_id' })
  ownerId: string;

  @QueryField({ type: 'date', column: 't.due' })
  due: string;

  @QueryField({ type: 'json', column: 't.metadata' })
  metadata: string;

  @QueryField({ type: 'number', column: 't.cost', requires: 'audit.view', sortable: true })
  cost: number;
}

@QueryResource({ name: 'spec_and_only', label: 'And only', permission: 'task.view', idColumn: 'a.id', defaultSort: [], logic: ['and'] })
export class SpecAndOnly {
  @QueryField({ type: 'string', column: 'a.name' })
  name: string;
}

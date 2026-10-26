import { QueryField, QueryResource } from '../../../core/query/query-resource.decorators.js';

/** A workspace's audit log as a filterable table. IP addresses are never part of the workspace view. */
@QueryResource({
  name: 'audit_log',
  label: 'Audit log',
  permission: 'audit.view',
  idColumn: 'log.id',
  defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  search: ['log.action', 'actor.name'],
})
export class AuditLogQueryResource {
  @QueryField({ type: 'datetime', column: 'log.created_at', label: 'When', sortable: true, display: 'date', width: 180 })
  createdAt: string;

  @QueryField({ type: 'user', column: 'log.actor_id', label: 'Who', display: 'avatar', width: 180 })
  actorId: string;

  @QueryField({ type: 'string', column: 'log.action', operators: ['eq', 'neq', 'starts_with', 'contains', 'in', 'nin'], sortable: true, display: 'code', width: 200 })
  action: string;

  @QueryField({ type: 'string', column: 'log.target_type', label: 'Target', operators: ['eq', 'neq', 'in', 'nin'], sortable: true, width: 120 })
  targetType: string;

  @QueryField({ type: 'string', column: 'log.target_id', label: 'Target id', operators: ['eq', 'in', 'is_null', 'is_not_null'], defaultVisible: false, display: 'code' })
  targetId: string;

  @QueryField({ type: 'json', column: 'log.metadata', field: 'audit.metadata', label: 'Details', operators: ['eq', 'contains', 'is_null', 'is_not_null'], display: 'code' })
  metadata: string;
}

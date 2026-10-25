import { QueryField, QueryResource } from '../../../core/query/query-resource.decorators.js';

export const MEMBER_RESOURCE = 'members';

/** Workspace members as a searchable, sortable table. Role options come from the workspace's roles. */
@QueryResource({
  name: MEMBER_RESOURCE,
  label: 'Members',
  idColumn: 'member.user_id',
  defaultSort: [{ field: 'name', direction: 'asc' }],
  search: ['account.name', 'account.email'],
})
export class MemberQueryResource {
  @QueryField({ type: 'string', column: 'account.name', sortable: true, display: 'avatar', width: 240 })
  name: string;

  @QueryField({ type: 'string', column: 'account.email', sortable: true, width: 260 })
  email: string;

  @QueryField({ type: 'uuid', column: 'member.role_id', label: 'Role', display: 'enum', width: 160 })
  roleId: string;

  @QueryField({ type: 'datetime', column: 'member.created_at', label: 'Joined', sortable: true, display: 'date', width: 140 })
  joinedAt: string;
}

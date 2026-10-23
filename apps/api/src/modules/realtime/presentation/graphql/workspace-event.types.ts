import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { RealtimeEntityType, WorkspaceEventResponse } from '@taskflow/shared-types';
import { RealtimeEntityTypeEnum } from '../../../../core/graphql/enums.js';

@ObjectType('WorkspaceEvent', { description: 'Something changed. Ids only: refetch the affected views to see it.' })
export class WorkspaceEventGql implements WorkspaceEventResponse {
  @Field({ description: 'e.g. task.updated' }) type: string;
  @Field(() => RealtimeEntityTypeEnum) entityType: RealtimeEntityType;
  @Field(() => ID) entityId: string;
  @Field(() => ID) actorId: string;
  @Field() occurredAt: string;
}

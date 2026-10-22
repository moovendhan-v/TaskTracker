import { ArgsType, Field, ID, ObjectType } from '@nestjs/graphql';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { AuditLogEntryResponse } from '@taskflow/shared-types';
import { JSONObjectScalar } from '../../../../core/graphql/json-object.scalar.js';
import { PageOf, WorkspacePageArgs } from '../../../../core/graphql/page.type.js';

@ObjectType('AuditLogEntry')
export class AuditLogEntryGql implements AuditLogEntryResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) actorId: string;
  @Field() actorName: string;
  @Field() action: string;
  @Field() targetType: string;
  @Field(() => String, { nullable: true }) targetId: string | null;
  @Field(() => ID, { nullable: true }) workspaceId: string | null;
  @Field(() => String, { nullable: true, description: 'Only shown to platform admins' }) ip: string | null;
  @Field(() => JSONObjectScalar) metadata: Record<string, unknown>;
  @Field() createdAt: string;
}

@ObjectType('AuditLogPage')
export class AuditLogPageGql extends PageOf(AuditLogEntryGql) {}

@ArgsType()
export class WorkspaceAuditArgs extends WorkspacePageArgs {
  @Field({ nullable: true, description: 'Prefix of the action name, e.g. "hr."' })
  @IsOptional()
  @Matches(/^[a-z_.]+$/, { message: 'action may contain lowercase letters, dots and underscores' })
  @MaxLength(80)
  action?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorId?: string;
}

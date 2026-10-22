import { ArgsType, Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import {
  PLATFORM_ROLES,
  type AdminUserResponse,
  type AdminWorkspaceResponse,
  type PlatformRole,
  type UpdateAdminUserRequest,
} from '@taskflow/shared-types';
import { PlatformRoleEnum } from '../../../../core/graphql/enums.js';
import { PageArgs, PageOf } from '../../../../core/graphql/page.type.js';

@ObjectType('AdminUser')
export class AdminUserGql implements AdminUserResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() email: string;
  @Field(() => PlatformRoleEnum) platformRole: PlatformRole;
  @Field() suspended: boolean;
  @Field(() => Int) workspaceCount: number;
  @Field() createdAt: string;
}

@ObjectType('AdminUserPage')
export class AdminUserPageGql extends PageOf(AdminUserGql) {}

@ObjectType('AdminWorkspace')
export class AdminWorkspaceGql implements AdminWorkspaceResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => ID) ownerId: string;
  @Field() ownerName: string;
  @Field(() => Int) memberCount: number;
  @Field() createdAt: string;
}

@ObjectType('AdminWorkspacePage')
export class AdminWorkspacePageGql extends PageOf(AdminWorkspaceGql) {}

@ArgsType()
export class AdminSearchArgs extends PageArgs {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

@ArgsType()
export class AdminAuditArgs extends PageArgs {
  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^[a-z_.]+$/, { message: 'action may contain lowercase letters, dots and underscores' })
  @MaxLength(80)
  action?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4')
  workspaceId?: string;
}

@InputType()
export class UpdateAdminUserInput implements UpdateAdminUserRequest {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  suspended?: boolean;

  @Field(() => PlatformRoleEnum, { nullable: true })
  @IsOptional()
  @IsIn(PLATFORM_ROLES)
  platformRole?: PlatformRole;
}

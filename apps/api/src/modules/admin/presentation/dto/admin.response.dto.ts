import { ApiProperty } from '@nestjs/swagger';
import { PLATFORM_ROLES, type AdminUserResponse, type AdminWorkspaceResponse, type Paginated, type PlatformRole } from '@taskflow/shared-types';

export class AdminUserResponseDto implements AdminUserResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: PLATFORM_ROLES }) platformRole: PlatformRole;
  @ApiProperty() suspended: boolean;
  @ApiProperty() workspaceCount: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class AdminUserPageResponseDto implements Paginated<AdminUserResponseDto> {
  @ApiProperty({ type: AdminUserResponseDto, isArray: true }) items: AdminUserResponseDto[];
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}

export class AdminWorkspaceResponseDto implements AdminWorkspaceResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() ownerId: string;
  @ApiProperty() ownerName: string;
  @ApiProperty() memberCount: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class AdminWorkspacePageResponseDto implements Paginated<AdminWorkspaceResponseDto> {
  @ApiProperty({ type: AdminWorkspaceResponseDto, isArray: true }) items: AdminWorkspaceResponseDto[];
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}

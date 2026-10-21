import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  COLOR_PATTERN,
  NAME_MAX,
  PERMISSIONS,
  type CreateWorkspaceRequest,
  type Permission,
  type UpdateWorkspaceRequest,
  type WorkspaceResponse,
} from '@taskflow/shared-types';

export class CreateWorkspaceDto implements CreateWorkspaceRequest {
  @ApiProperty({ maxLength: NAME_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;

  @ApiPropertyOptional({ pattern: COLOR_PATTERN, example: '#6366f1' })
  @IsOptional()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;
}

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) implements UpdateWorkspaceRequest {}

export class WorkspaceDto implements WorkspaceResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() color: string;
  @ApiProperty() roleName: string;
  @ApiProperty({ enum: PERMISSIONS, isArray: true }) permissions: Permission[];
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

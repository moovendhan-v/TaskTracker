import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  PERMISSIONS,
  ROLE_NAME_MAX,
  type CreateRoleRequest,
  type Permission,
  type RoleResponse,
  type UpdateRoleRequest,
} from '@taskflow/shared-types';

export class CreateRoleDto implements CreateRoleRequest {
  @ApiProperty({ maxLength: ROLE_NAME_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(ROLE_NAME_MAX)
  name: string;

  @ApiProperty({ enum: PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(PERMISSIONS.length)
  @IsIn(PERMISSIONS, { each: true })
  permissions: Permission[];
}

export class UpdateRoleDto implements UpdateRoleRequest {
  @ApiPropertyOptional({ maxLength: ROLE_NAME_MAX })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ROLE_NAME_MAX)
  name?: string;

  @ApiPropertyOptional({ enum: PERMISSIONS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(PERMISSIONS.length)
  @IsIn(PERMISSIONS, { each: true })
  permissions?: Permission[];
}

export class RoleDto implements RoleResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) systemKey: string | null;
  @ApiProperty({ enum: PERMISSIONS, isArray: true }) permissions: Permission[];
}

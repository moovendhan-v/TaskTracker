import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PERMISSIONS, ROLE_NAME_MAX, type CreateRoleRequest, type Permission } from '@taskflow/shared-types';

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

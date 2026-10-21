import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import type { UpdateMemberRoleRequest } from '@taskflow/shared-types';

export class UpdateMemberRoleDto implements UpdateMemberRoleRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  roleId: string;
}

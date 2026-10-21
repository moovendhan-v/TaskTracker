import { ApiProperty } from '@nestjs/swagger';
import { PERMISSIONS, type Permission, type RoleResponse } from '@taskflow/shared-types';

export class RoleResponseDto implements RoleResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) systemKey: string | null;
  @ApiProperty({ enum: PERMISSIONS, isArray: true }) permissions: Permission[];
}

import { ApiProperty } from '@nestjs/swagger';
import { PERMISSIONS, type Permission, type WorkspaceResponse } from '@taskflow/shared-types';

export class WorkspaceResponseDto implements WorkspaceResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() color: string;
  @ApiProperty() roleName: string;
  @ApiProperty({ enum: PERMISSIONS, isArray: true }) permissions: Permission[];
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

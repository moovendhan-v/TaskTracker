import { ApiProperty } from '@nestjs/swagger';
import type { SpaceResponse } from '@taskflow/shared-types';

export class SpaceResponseDto implements SpaceResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) workspaceId: string;
  @ApiProperty() name: string;
  @ApiProperty() color: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

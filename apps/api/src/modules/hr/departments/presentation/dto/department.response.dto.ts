import { ApiProperty } from '@nestjs/swagger';
import type { DepartmentResponse } from '@taskflow/shared-types';

export class DepartmentResponseDto implements DepartmentResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) headUserId: string | null;
  @ApiProperty() memberCount: number;
}

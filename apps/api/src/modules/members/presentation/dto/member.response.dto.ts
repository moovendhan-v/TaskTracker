import { ApiProperty } from '@nestjs/swagger';
import type { MemberResponse } from '@taskflow/shared-types';

export class MemberResponseDto implements MemberResponse {
  @ApiProperty() userId: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ format: 'uuid' }) roleId: string;
  @ApiProperty() roleName: string;
  @ApiProperty({ format: 'date-time' }) joinedAt: string;
}

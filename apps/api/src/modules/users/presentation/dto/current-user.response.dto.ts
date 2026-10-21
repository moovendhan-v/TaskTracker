import { ApiProperty } from '@nestjs/swagger';
import { PLATFORM_ROLES, type CurrentUserResponse, type PlatformRole } from '@taskflow/shared-types';

export class CurrentUserResponseDto implements CurrentUserResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ type: String, nullable: true }) image: string | null;
  @ApiProperty({ enum: PLATFORM_ROLES }) platformRole: PlatformRole;
}

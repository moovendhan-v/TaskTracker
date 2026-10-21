import { ApiProperty } from '@nestjs/swagger';

export class AddMemberResultResponseDto {
  @ApiProperty() message: string;
}

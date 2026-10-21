import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NAME_MAX, type CreateTaskListRequest } from '@taskflow/shared-types';

export class CreateTaskListDto implements CreateTaskListRequest {
  @ApiProperty({ maxLength: NAME_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';
import type { CompleteSprintRequest } from '@taskflow/shared-types';

export class CompleteSprintDto implements CompleteSprintRequest {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'null sends unfinished tasks to the backlog' })
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  moveOpenTasksToSprintId: string | null;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { LEAVE_STATUSES, type LeaveRequestQuery, type LeaveStatus } from '@taskflow/shared-types';
import { PageQueryDto } from '../../../../../core/http/dto/page-query.dto.js';

export class LeaveRequestQueryDto extends PageQueryDto implements LeaveRequestQuery {
  @ApiPropertyOptional({ enum: LEAVE_STATUSES })
  @IsOptional()
  @IsIn(LEAVE_STATUSES)
  status?: LeaveStatus;
}

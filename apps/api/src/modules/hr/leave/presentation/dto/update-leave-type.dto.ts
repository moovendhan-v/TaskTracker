import { PartialType } from '@nestjs/swagger';
import type { UpdateLeaveTypeRequest } from '@taskflow/shared-types';
import { CreateLeaveTypeDto } from './create-leave-type.dto.js';

export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) implements UpdateLeaveTypeRequest {}

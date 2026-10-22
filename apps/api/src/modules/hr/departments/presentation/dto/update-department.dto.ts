import { PartialType } from '@nestjs/swagger';
import type { UpdateDepartmentRequest } from '@taskflow/shared-types';
import { CreateDepartmentDto } from './create-department.dto.js';

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) implements UpdateDepartmentRequest {}

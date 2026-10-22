import { PartialType } from '@nestjs/swagger';
import type { UpdateSprintRequest } from '@taskflow/shared-types';
import { CreateSprintDto } from './create-sprint.dto.js';

export class UpdateSprintDto extends PartialType(CreateSprintDto) implements UpdateSprintRequest {}

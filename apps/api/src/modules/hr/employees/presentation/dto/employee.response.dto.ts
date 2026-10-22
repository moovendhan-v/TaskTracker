import { ApiProperty } from '@nestjs/swagger';
import { EMPLOYMENT_TYPES, type EmployeeResponse, type EmploymentType } from '@taskflow/shared-types';

export class EmployeeResponseDto implements EmployeeResponse {
  @ApiProperty() userId: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ type: String, nullable: true }) jobTitle: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) departmentId: string | null;
  @ApiProperty({ type: String, nullable: true }) departmentName: string | null;
  @ApiProperty({ type: String, nullable: true }) managerUserId: string | null;
  @ApiProperty({ enum: EMPLOYMENT_TYPES, nullable: true }) employmentType: EmploymentType | null;
  @ApiProperty({ type: String, format: 'date', nullable: true }) startDate: string | null;
}

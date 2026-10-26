import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsCalendarDate, IsClearable } from '../../../../../core/graphql/validation.js';
import {
  EMPLOYMENT_TYPES,
  JOB_TITLE_MAX,
  type EmployeeResponse,
  type EmploymentType,
  type UpsertEmployeeProfileRequest,
} from '@taskflow/shared-types';
import { EmploymentTypeEnum } from '../../../../../core/graphql/enums.js';
import { FormSchema } from '../../../../../core/forms/form-schema.decorators.js';
import { SensitiveField } from '../../../../../core/access/sensitive-field.decorator.js';

@ObjectType('Employee')
export class EmployeeGql implements EmployeeResponse {
  @Field(() => ID) userId: string;
  @Field() name: string;
  @SensitiveField('member.email', () => String) email: string | null;
  @Field(() => String, { nullable: true }) jobTitle: string | null;
  @Field(() => ID, { nullable: true }) departmentId: string | null;
  @Field(() => String, { nullable: true }) departmentName: string | null;
  @Field(() => ID, { nullable: true }) managerUserId: string | null;
  @SensitiveField('employee.employmentType', () => EmploymentTypeEnum) employmentType: EmploymentType | null;
  @SensitiveField('employee.startDate', () => String, { description: 'yyyy-mm-dd' }) startDate: string | null;
}

/** Omit a field to keep it; send null to clear it. */
@FormSchema('hr.employee.update')
@InputType()
export class EmployeeProfileInput implements UpsertEmployeeProfileRequest {
  @Field(() => String, { nullable: true })
  @IsClearable()
  @IsString()
  @MaxLength(JOB_TITLE_MAX)
  jobTitle?: string | null;

  @Field(() => ID, { nullable: true })
  @IsClearable()
  @IsUUID('4')
  departmentId?: string | null;

  @Field(() => ID, { nullable: true })
  @IsClearable()
  @IsString()
  @MaxLength(64)
  managerUserId?: string | null;

  @Field(() => EmploymentTypeEnum, { nullable: true })
  @IsClearable()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: EmploymentType | null;

  @Field(() => String, { nullable: true })
  @IsClearable()
  @IsCalendarDate()
  startDate?: string | null;
}

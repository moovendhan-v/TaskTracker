import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsString, MaxLength } from 'class-validator';
import { CHECKLIST_TITLE_MAX, type ChecklistItemResponse } from '@taskflow/shared-types';
import { IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('ChecklistItem', { description: 'One step of a task checklist' })
export class ChecklistItemGql implements ChecklistItemResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) taskId: string;
  @Field() title: string;
  @Field() done: boolean;
  @Field(() => String, { nullable: true }) doneAt: string | null;
  @Field(() => String, { nullable: true }) doneByName: string | null;
  @Field(() => Float) position: number;
  @Field() createdAt: string;
}

@InputType('UpdateChecklistItemInput')
export class UpdateChecklistItemInput {
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(CHECKLIST_TITLE_MAX * 2) title?: string;
  @Field({ nullable: true }) @IsOmittable() @IsBoolean() done?: boolean;
}

import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsIn, IsNumber, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import {
  COLOR_PATTERN,
  ICON_KEYS,
  NAME_MAX,
  type CreateFolderRequest,
  type CreateTaskListRequest,
  type FolderResponse,
  type IconKey,
  type MoveFolderRequest,
  type MoveTaskListRequest,
  type TaskListResponse,
  type UpdateFolderRequest,
  type UpdateTaskListRequest,
} from '@taskflow/shared-types';
import { IconKeyEnum } from '../../../../core/graphql/enums.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('TaskList')
export class TaskListGql implements TaskListResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field(() => ID, { nullable: true, description: 'Null: directly under the space' }) folderId: string | null;
  @Field() name: string;
  @Field(() => String, { nullable: true }) color: string | null;
  @Field(() => IconKeyEnum, { nullable: true }) icon: IconKey | null;
  @Field(() => Float) position: number;
  @Field() createdAt: string;
}

@ObjectType('Folder')
export class FolderGql implements FolderResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) spaceId: string;
  @Field(() => ID, { nullable: true }) parentId: string | null;
  @Field() name: string;
  @Field(() => String, { nullable: true }) color: string | null;
  @Field(() => IconKeyEnum, { nullable: true }) icon: IconKey | null;
  @Field(() => Float) position: number;
  @Field() createdAt: string;
}

/** Name, colour and icon, shared by lists and folders. */
@InputType({ isAbstract: true })
abstract class AppearanceInput {
  @Field(() => String, { nullable: true })
  @IsClearable()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string | null;

  @Field(() => IconKeyEnum, { nullable: true })
  @IsClearable()
  @IsIn(ICON_KEYS)
  icon?: IconKey | null;
}

@FormSchema('list.save')
@InputType()
export class TaskListInput extends AppearanceInput implements CreateTaskListRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name: string;

  @Field(() => ID, { nullable: true, description: 'Create the list inside this folder' })
  @IsClearable()
  @IsUUID('4')
  folderId?: string | null;
}

@FormSchema('list.update')
@InputType()
export class UpdateTaskListInput extends AppearanceInput implements UpdateTaskListRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name?: string;
}

@InputType()
export class MoveTaskListInput implements MoveTaskListRequest {
  @Field(() => ID, { nullable: true, description: 'Null: directly under the space' })
  @IsClearable()
  @IsUUID('4')
  folderId: string | null;

  @Field(() => Float, { nullable: true })
  @IsOmittable()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;
}

@FormSchema('folder.create')
@InputType()
export class CreateFolderInput extends AppearanceInput implements CreateFolderRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name: string;

  @Field(() => ID, { nullable: true, description: 'Nest inside this folder' })
  @IsClearable()
  @IsUUID('4')
  parentId?: string | null;
}

@FormSchema('folder.update')
@InputType()
export class UpdateFolderInput extends AppearanceInput implements UpdateFolderRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotBlank()
  @MaxLength(NAME_MAX)
  name?: string;
}

@InputType()
export class MoveFolderInput implements MoveFolderRequest {
  @Field(() => ID, { nullable: true, description: 'Null: directly under the space' })
  @IsClearable()
  @IsUUID('4')
  parentId: string | null;

  @Field(() => Float, { nullable: true })
  @IsOmittable()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;
}

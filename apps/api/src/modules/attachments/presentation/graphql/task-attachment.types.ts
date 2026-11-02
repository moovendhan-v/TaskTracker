import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { TASK_UPLOAD_MAX_BYTES, type TaskAttachmentResponse, type TaskUploadResult, type TaskUploadTicket } from '@taskflow/shared-types';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { IsNotBlank } from '../../../../core/graphql/validation.js';

@ObjectType('TaskAttachment')
export class TaskAttachmentGql implements TaskAttachmentResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) taskId: string;
  @Field() fileName: string;
  @Field() contentType: string;
  @Field(() => Int) size: number;
  @Field() isImage: boolean;
  @Field({ description: 'Short-lived signed link on this origin; list again for a fresh one' }) url: string;
  @Field(() => ID, { nullable: true }) uploaderId: string | null;
  @Field(() => String, { nullable: true }) uploaderName: string | null;
  @Field() createdAt: string;
}

@ObjectType('TaskUploadTicket')
export class TaskUploadTicketGql implements TaskUploadTicket {
  @Field(() => ID) attachmentId: string;
  @Field({ description: 'PUT the raw file here with its Content-Length, then call completeTaskUpload' }) uploadUrl: string;
  @Field(() => Int) maxBytes: number;
}

@ObjectType('TaskUploadResult', { description: 'The checked file, or why it was refused (it is deleted then)' })
export class TaskUploadResultGql implements TaskUploadResult {
  @Field(() => TaskAttachmentGql, { nullable: true }) attachment: TaskAttachmentGql | null;
  @Field(() => String, { nullable: true }) error: string | null;
}

@InputType('RequestTaskUploadInput')
export class RequestTaskUploadInput {
  @Field(() => ID) @IsUUID() taskId: string;
  @Field() @IsString() @IsNotBlank() @MaxLength(255) fileName: string;
  @Field(() => Int) @IsInt() @Min(1) @Max(TASK_UPLOAD_MAX_BYTES) size: number;
}

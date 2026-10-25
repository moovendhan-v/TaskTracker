import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsString, MaxLength } from 'class-validator';
import { IsNotBlank } from '../../../../core/graphql/validation.js';
import { COMMENT_BODY_MAX, type CommentResponse, type CreateCommentRequest } from '@taskflow/shared-types';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';

@ObjectType('Comment')
export class CommentGql implements CommentResponse {
  @Field(() => ID) id: string;
  @Field(() => ID) taskId: string;
  @Field(() => ID) authorId: string;
  @Field() authorName: string;
  @Field({ description: 'Plain text; render as text, never HTML' }) body: string;
  @Field() createdAt: string;
  @Field() updatedAt: string;
}

@FormSchema('comment.save')
@InputType()
export class CommentInput implements CreateCommentRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(COMMENT_BODY_MAX)
  body: string;
}

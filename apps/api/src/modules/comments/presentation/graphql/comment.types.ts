import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { COMMENT_BODY_MAX, type CommentResponse, type CreateCommentRequest } from '@taskflow/shared-types';

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

@InputType()
export class CommentInput implements CreateCommentRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_BODY_MAX)
  body: string;
}

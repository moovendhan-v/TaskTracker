import type { UpdateCommentRequest } from '@taskflow/shared-types';
import { CreateCommentDto } from './create-comment.dto.js';

export class UpdateCommentDto extends CreateCommentDto implements UpdateCommentRequest {}

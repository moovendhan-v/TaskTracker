import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';
import { getRequest } from '../request-context.js';

/** The whole request, for the rare resolver that needs more than the user (e.g. a subscription re-checking the session). */
export const CurrentRequest = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedRequest => getRequest(ctx));

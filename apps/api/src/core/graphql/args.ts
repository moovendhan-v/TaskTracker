import { Args, ID } from '@nestjs/graphql';
import { UUID_PIPE } from '../http/pipes/uuid.pipe.js';

/** The `workspaceId` argument every workspace-scoped operation takes; WorkspaceAccessGuard checks it. */
export const WorkspaceIdArg = (): ParameterDecorator => Args('workspaceId', { type: () => ID }, UUID_PIPE);

/** A UUID argument, rejected with BAD_USER_INPUT when malformed. */
export const UuidArg = (name: string): ParameterDecorator => Args(name, { type: () => ID }, UUID_PIPE);

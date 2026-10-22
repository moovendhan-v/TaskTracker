import { Args, ID } from '@nestjs/graphql';
import { OPTIONAL_UUID_PIPE, UUID_PIPE } from '../http/pipes/uuid.pipe.js';

/** The `workspaceId` argument every workspace-scoped operation takes; WorkspaceAccessGuard checks it. */
export const WorkspaceIdArg = (): ParameterDecorator => Args('workspaceId', { type: () => ID }, UUID_PIPE);

/** A UUID argument, rejected with BAD_USER_INPUT when malformed. */
export const UuidArg = (name: string): ParameterDecorator => Args(name, { type: () => ID }, UUID_PIPE);

/** A nullable UUID argument: null or omitted means "none", anything else must be a valid UUID. */
export const OptionalUuidArg = (name: string, description?: string): ParameterDecorator =>
  Args(name, { type: () => ID, nullable: true, description }, OPTIONAL_UUID_PIPE);

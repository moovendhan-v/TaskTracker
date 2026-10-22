import { InitialSchema1729550000000 } from './1729550000000-initial-schema.js';
import { HardenUserFields1729550100000 } from './1729550100000-harden-user-fields.js';
import { TaskComments1729560000000 } from './1729560000000-task-comments.js';

/** Registered in order. Add new migrations to the end. */
export const MIGRATIONS = [InitialSchema1729550000000, HardenUserFields1729550100000, TaskComments1729560000000];

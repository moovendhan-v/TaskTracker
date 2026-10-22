import { InitialSchema1729550000000 } from './1729550000000-initial-schema.js';
import { HardenUserFields1729550100000 } from './1729550100000-harden-user-fields.js';
import { TaskComments1729560000000 } from './1729560000000-task-comments.js';
import { Sprints1729570000000 } from './1729570000000-sprints.js';
import { Documents1729580000000 } from './1729580000000-documents.js';
import { Hr1729590000000 } from './1729590000000-hr.js';

/** Registered in order. Add new migrations to the end. */
export const MIGRATIONS = [InitialSchema1729550000000, HardenUserFields1729550100000, TaskComments1729560000000, Sprints1729570000000, Documents1729580000000, Hr1729590000000];

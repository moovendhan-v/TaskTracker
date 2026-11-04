import type { AutomationFlow, AutomationTrigger } from '@taskflow/shared-types';

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  flow: AutomationFlow;
}

/**
 * Starting points for a new automation. They hold no ids from any workspace
 * (statuses, people and channels are picked after), so each is valid anywhere
 * once its blanks are filled.
 */
export const AUTOMATION_TEMPLATES: readonly AutomationTemplate[] = [
  {
    id: 'urgent-bugs',
    name: 'Triage urgent bugs',
    description: 'A new urgent bug gets a due date tomorrow and a note to triage it',
    trigger: { type: 'task_created' },
    flow: {
      steps: [
        {
          id: 'if-1',
          kind: 'if',
          condition: { field: 'type', types: ['bug'] },
          yes: [
            {
              id: 'if-2',
              kind: 'if',
              condition: { field: 'priority', priorities: ['urgent'] },
              yes: [
                { id: 'action-1', kind: 'action', action: { type: 'set_due_date', days: 1 } },
                { id: 'action-2', kind: 'action', action: { type: 'comment', message: 'Urgent bug: triage {{task}} today.' } },
              ],
              no: [],
            },
          ],
          no: [],
        },
      ],
    },
  },
  {
    id: 'overdue-nudge',
    name: 'Nudge, then escalate overdue work',
    description: 'Comment when a task goes overdue; a day later, if it still is, raise it and tell the assignee and creator',
    trigger: { type: 'task_overdue' },
    flow: {
      steps: [
        { id: 'action-1', kind: 'action', action: { type: 'comment', message: '{{task}} is past its due date.' } },
        { id: 'wait-1', kind: 'wait', minutes: 1440 },
        {
          id: 'if-1',
          kind: 'if',
          condition: { field: 'due', match: 'overdue' },
          yes: [
            { id: 'action-2', kind: 'action', action: { type: 'set_priority', priority: 'urgent' } },
            { id: 'action-3', kind: 'action', action: { type: 'notify', audiences: ['assignee', 'creator'], message: '{{task}} is still overdue.' } },
          ],
          no: [],
        },
      ],
    },
  },
  {
    id: 'due-soon',
    name: 'Remind before the due date',
    description: 'Tell the assignee the day before a task is due',
    trigger: { type: 'task_due_soon', days: 1 },
    flow: { steps: [{ id: 'action-1', kind: 'action', action: { type: 'notify', audiences: ['assignee'], message: '{{task}} is due tomorrow.' } }] },
  },
  {
    id: 'done-to-chat',
    name: 'Announce finished work in chat',
    description: 'Post in a channel when a task is done (pick the channel)',
    trigger: { type: 'task_status_changed', categories: ['done'] },
    flow: { steps: [{ id: 'action-1', kind: 'action', action: { type: 'post_chat', message: '✅ {{task}} is done' } }] },
  },
];

import { isClosedCategory, type SprintResponse, type TaskResponse, type TeamAbsenceResponse } from '@taskflow/shared-types';

/** Focus hours per working day assumed for capacity (meetings and the rest take the remainder). */
export const FOCUS_HOURS_PER_DAY = 6;

const DAY = 86_400_000;
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Mon–Fri days from `start` to `end`, both included. */
export function workingDays(start: string, end: string): number {
  let days = 0;
  for (let at = time(start); at <= time(end); at += DAY) {
    const weekday = new Date(at).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
}

export interface PersonCapacity {
  userId: string;
  /** Working days in the sprint, and how many of them the person is on approved leave. */
  workDays: number;
  leaveDays: number;
  availableHours: number;
  /** Estimated work of their open tasks; shared tasks are split evenly between assignees. */
  plannedHours: number;
  openTasks: number;
  unestimated: number;
  /** plannedHours / availableHours, or null when they have no time in the sprint. */
  load: number | null;
}

/**
 * Who has how much time in a sprint and how much is planned for them. Only people
 * with open tasks in the sprint are listed, most loaded first.
 */
export function capacityByPerson(
  sprint: Pick<SprintResponse, 'startDate' | 'endDate'>,
  tasks: readonly Pick<TaskResponse, 'assigneeId' | 'assigneeIds' | 'estimateMinutes' | 'status'>[],
  absences: readonly TeamAbsenceResponse[],
  hoursPerDay = FOCUS_HOURS_PER_DAY,
): PersonCapacity[] {
  const workDays = workingDays(sprint.startDate, sprint.endDate);
  const people = new Map<string, { minutes: number; open: number; unestimated: number }>();
  for (const task of tasks) {
    if (isClosedCategory(task.status.category)) continue;
    const assignees = task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [];
    for (const userId of assignees) {
      const entry = people.get(userId) ?? { minutes: 0, open: 0, unestimated: 0 };
      entry.open += 1;
      if (task.estimateMinutes) entry.minutes += task.estimateMinutes / assignees.length;
      else entry.unestimated += 1;
      people.set(userId, entry);
    }
  }
  return [...people.entries()]
    .map(([userId, entry]) => {
      const leaveDays = Math.min(
        workDays,
        absences
          .filter((absence) => absence.userId === userId && absence.startDate <= sprint.endDate && absence.endDate >= sprint.startDate)
          .reduce((sum, absence) => sum + workingDays(absence.startDate > sprint.startDate ? absence.startDate : sprint.startDate, absence.endDate < sprint.endDate ? absence.endDate : sprint.endDate), 0),
      );
      const availableHours = (workDays - leaveDays) * hoursPerDay;
      const plannedHours = Math.round((entry.minutes / 60) * 10) / 10;
      return { userId, workDays, leaveDays, availableHours, plannedHours, openTasks: entry.open, unestimated: entry.unestimated, load: availableHours ? plannedHours / availableHours : null };
    })
    .sort((a, b) => (b.load ?? Infinity) - (a.load ?? Infinity));
}

import type { TaskResponse } from '@taskflow/shared-types';
import { downloadCsv } from '@/lib/export-csv';

/** Downloads tasks as CSV with the columns people usually need in a spreadsheet. */
export function exportTasks(tasks: readonly TaskResponse[], memberName: (userId: string | null) => string | null, filename = 'tasks.csv'): void {
  downloadCsv(
    filename,
    ['Number', 'Title', 'Type', 'Status', 'Priority', 'Assignee', 'Start', 'Due', 'Estimate (min)', 'Progress', 'Completed', 'Created'],
    tasks.map((task) => [
      task.number,
      task.title,
      task.type,
      task.status.name,
      task.priority,
      memberName(task.assigneeId) ?? '',
      task.startDate?.slice(0, 10) ?? '',
      task.dueDate?.slice(0, 10) ?? '',
      task.estimateMinutes ?? '',
      task.progress ?? '',
      task.completedAt?.slice(0, 10) ?? '',
      task.createdAt.slice(0, 10),
    ]),
  );
}

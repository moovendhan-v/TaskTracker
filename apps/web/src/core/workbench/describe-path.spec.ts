import { describe, expect, it } from 'vitest';
import { describePath } from './describe-path';

const WS = '/w/11111111-1111-4111-8111-111111111111';

describe('describePath', () => {
  it('labels fixed pages, ignoring the query', () => {
    expect(describePath(WS).label).toBe('Home');
    expect(describePath(`${WS}/`).label).toBe('Home');
    expect(describePath(`${WS}/inbox?task=abc`).label).toBe('Inbox');
    expect(describePath(`${WS}/people/time-off`).label).toBe('Time off');
  });

  it('points dynamic pages at the record that names them', () => {
    expect(describePath(`${WS}/l/list-1`).entity).toEqual({ kind: 'list', id: 'list-1' });
    expect(describePath(`${WS}/p/space-1/board`).entity).toEqual({ kind: 'space', id: 'space-1', view: 'board' });
    expect(describePath(`${WS}/docs/doc-1`).entity).toEqual({ kind: 'document', id: 'doc-1' });
    expect(describePath(`${WS}/sprints/s-1`).entity).toEqual({ kind: 'sprint', id: 's-1' });
  });

  it('falls back to a generic label', () => {
    expect(describePath(`${WS}/something/new`).label).toBe('Page');
  });
});

describe('people and access pages', () => {
  it('names the Access and Attendance tabs', () => {
    expect(describePath('/w/ws/access').label).toBe('Access');
    expect(describePath('/w/ws/people/attendance').label).toBe('Attendance');
  });
});

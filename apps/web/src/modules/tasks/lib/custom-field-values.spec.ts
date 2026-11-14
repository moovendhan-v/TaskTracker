import { describe, expect, it } from 'vitest';
import type { CustomFieldResponse } from '@taskflow/shared-types';
import { fieldInputText, fieldsForTask, parseFieldInput } from './custom-field-values';

const field = (id: string, spaceId: string | null, position: number, entity: 'task' | 'space' = 'task'): CustomFieldResponse => ({ id, spaceId, entity, name: id, type: 'text', options: [], required: false, position });

describe('custom field values in the task panel', () => {
  it('shows workspace-wide fields and the project’s own, in order', () => {
    const fields = [field('b', 'space-1', 2), field('a', null, 1), field('other', 'space-2', 0), field('project', null, 0, 'space')];
    expect(fieldsForTask(fields, 'space-1').map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('reads what was typed by the field’s type, like the server', () => {
    expect(parseFieldInput('number', ' 42 ')).toEqual({ value: 42 });
    expect(parseFieldInput('money', '1,234.567')).toEqual({ value: 1234.57 });
    expect(parseFieldInput('number', 'lots')).toEqual({ error: 'Use a number' });
    expect(parseFieldInput('url', 'example.com')).toEqual({ error: 'Use a full https:// link' });
    expect(parseFieldInput('url', 'https://example.com/a')).toEqual({ value: 'https://example.com/a' });
    expect(parseFieldInput('email', 'dana@example.com')).toEqual({ value: 'dana@example.com' });
    expect(parseFieldInput('email', 'dana')).toEqual({ error: 'Use an email address' });
    expect(parseFieldInput('date', '2026-11-20')).toEqual({ value: '2026-11-20' });
    expect(parseFieldInput('text', '  ')).toEqual({ value: null });
    expect(fieldInputText(3.5)).toBe('3.5');
    expect(fieldInputText(null)).toBe('');
    expect(fieldInputText(['x'])).toBe('');
  });
});

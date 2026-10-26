import { describe, expect, it } from 'vitest';
import { toFilter, type DraftCondition } from './filters';

const row = (extra: Partial<DraftCondition>): DraftCondition => ({ id: 'x', field: 'title', key: '', op: 'contains', value: '', ...extra });

describe('toFilter', () => {
  it('skips incomplete rows and unwraps a single condition', () => {
    expect(toFilter([row({ value: 'ship' }), row({ value: '  ' })], 'and')).toEqual({ field: 'title', op: 'contains', value: 'ship' });
    expect(toFilter([row({})], 'and')).toBeNull();
  });

  it('builds lists, nullary operators, json keys and the chosen logic', () => {
    expect(
      toFilter(
        [row({ field: 'priority', op: 'in', value: 'high, urgent' }), row({ field: 'dueDate', op: 'is_null' }), row({ field: 'metadata', key: 'order_id', op: 'eq', value: '6735' })],
        'or',
      ),
    ).toEqual({
      or: [
        { field: 'priority', op: 'in', values: ['high', 'urgent'] },
        { field: 'dueDate', op: 'is_null' },
        { field: 'metadata.order_id', op: 'eq', value: '6735' },
      ],
    });
  });
});

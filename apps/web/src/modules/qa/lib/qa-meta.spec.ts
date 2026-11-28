import { describe, expect, it } from 'vitest';
import { overallResult } from './qa-meta';

describe('overallResult', () => {
  it('derives a case result from its steps', () => {
    const step = (result: 'passed' | 'failed' | 'blocked' | 'skipped') => ({ result, actual: '' });
    expect(overallResult([])).toBeNull();
    expect(overallResult([step('passed'), step('passed')])).toBe('passed');
    expect(overallResult([step('passed'), step('skipped')])).toBe('passed');
    expect(overallResult([step('passed'), step('blocked')])).toBe('blocked');
    expect(overallResult([step('blocked'), step('failed')])).toBe('failed');
    expect(overallResult([step('skipped')])).toBe('skipped');
  });
});

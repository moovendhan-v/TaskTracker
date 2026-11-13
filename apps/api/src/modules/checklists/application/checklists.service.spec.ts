import { describe, expect, it } from 'vitest';
import { cleanStepTitle } from './checklists.service.js';

describe('cleanStepTitle', () => {
  it('keeps a step to one tidy line', () => {
    expect(cleanStepTitle('  Write   the\nrelease notes\t')).toBe('Write the release notes');
    expect(cleanStepTitle('a b')).toBe('a b');
  });

  it('refuses empty or overlong steps', () => {
    expect(() => cleanStepTitle(' \n ')).toThrow(/Write what the step is/);
    expect(() => cleanStepTitle('x'.repeat(301))).toThrow(/at most 300/);
  });
});

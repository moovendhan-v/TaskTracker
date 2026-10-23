import { describe, expect, it } from 'vitest';
import { ReportingLinePolicy } from './reporting-line.policy.js';

describe('ReportingLinePolicy', () => {
  it('accepts a normal chain', () => {
    expect(() => ReportingLinePolicy.assertValidManager('dev', ['lead', 'cto'])).not.toThrow();
  });

  it('rejects self-management and loops', () => {
    expect(() => ReportingLinePolicy.assertValidManager('dev', ['dev'])).toThrow(/themselves/);
    expect(() => ReportingLinePolicy.assertValidManager('cto', ['dev', 'lead', 'cto'])).toThrow(/circular/);
  });
});

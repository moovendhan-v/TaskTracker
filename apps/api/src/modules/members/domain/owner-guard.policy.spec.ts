import { describe, expect, it } from 'vitest';
import { OwnerGuardPolicy } from './owner-guard.policy.js';

describe('OwnerGuardPolicy', () => {
  it('blocks removing the only owner', () => {
    expect(() => OwnerGuardPolicy.assertAnotherOwnerRemains(1)).toThrow(/at least one owner/);
  });

  it('allows removing an owner when another remains', () => {
    expect(() => OwnerGuardPolicy.assertAnotherOwnerRemains(2)).not.toThrow();
  });
});

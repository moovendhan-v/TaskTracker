import { describe, expect, it } from 'vitest';
import type { Permission } from '@taskflow/shared-types';
import { countWorkingDays } from './leave-days.calculator.js';
import { LeaveApprovalPolicy } from './leave-approval.policy.js';
import type { LeaveRequest } from './leave-request.js';
import { LeaveRequestPolicy } from './leave-request.policy.js';

describe('countWorkingDays', () => {
  it('counts Monday to Friday, inclusive', () => {
    expect(countWorkingDays('2026-11-02', '2026-11-06')).toBe(5); // Mon–Fri
    expect(countWorkingDays('2026-11-06', '2026-11-09')).toBe(2); // Fri–Mon
    expect(countWorkingDays('2026-11-07', '2026-11-08')).toBe(0); // weekend
    expect(countWorkingDays('2026-11-02', '2026-11-15')).toBe(10); // two weeks
    expect(countWorkingDays('2026-11-05', '2026-11-04')).toBe(0); // reversed
  });
});

describe('LeaveRequestPolicy', () => {
  it('returns working days for a valid range', () => expect(LeaveRequestPolicy.validateRange('2026-11-02', '2026-11-04')).toBe(3));

  it('rejects weekends only, reversed ranges, year crossings and overlong requests', () => {
    expect(() => LeaveRequestPolicy.validateRange('2026-11-07', '2026-11-08')).toThrow(/no working days/);
    expect(() => LeaveRequestPolicy.validateRange('2026-11-04', '2026-11-02')).toThrow(/on or after/);
    expect(() => LeaveRequestPolicy.validateRange('2026-12-30', '2027-01-02')).toThrow(/new year/);
    expect(() => LeaveRequestPolicy.validateRange('2026-01-01', '2026-06-30')).toThrow(/at most/);
  });
});

describe('LeaveApprovalPolicy', () => {
  const request = { userId: 'emp', status: 'pending', startDate: '2026-11-10' } as LeaveRequest;
  const approver = new Set<Permission>(['leave.approve']);

  it('lets an approver decide someone else’s pending request', () => {
    expect(() => LeaveApprovalPolicy.assertCanDecide(request, 'lead', approver)).not.toThrow();
  });

  it('blocks self-approval, missing permission and repeat decisions', () => {
    expect(() => LeaveApprovalPolicy.assertCanDecide(request, 'emp', approver)).toThrow(/your own/);
    expect(() => LeaveApprovalPolicy.assertCanDecide(request, 'lead', new Set())).toThrow(/leave.approve/);
    expect(() => LeaveApprovalPolicy.assertCanDecide({ ...request, status: 'approved' }, 'lead', approver)).toThrow(/already/);
  });

  it('checks the allowance, with null meaning unlimited', () => {
    expect(() => LeaveApprovalPolicy.assertWithinAllowance(20, 18, 2)).not.toThrow();
    expect(() => LeaveApprovalPolicy.assertWithinAllowance(20, 18, 3)).toThrow(/2 day\(s\) left/);
    expect(() => LeaveApprovalPolicy.assertWithinAllowance(null, 500, 30)).not.toThrow();
  });

  it('allows cancelling own pending or future approved time off only', () => {
    expect(() => LeaveApprovalPolicy.assertCanCancel(request, 'emp', '2026-11-01')).not.toThrow();
    expect(() => LeaveApprovalPolicy.assertCanCancel({ ...request, status: 'approved' }, 'emp', '2026-11-01')).not.toThrow();
    expect(() => LeaveApprovalPolicy.assertCanCancel({ ...request, status: 'approved' }, 'emp', '2026-11-10')).toThrow();
    expect(() => LeaveApprovalPolicy.assertCanCancel(request, 'someone', '2026-11-01')).toThrow(/your own/);
  });
});

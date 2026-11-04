import { canInSpace, evaluatePolicies, explainPermission, MANAGED_POLICIES, PERMISSIONS, type PolicyDocument } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';

const HR = '1f6c2a8e-3a52-4c1e-9d1a-2b3c4d5e6f71';
const OPS = '2f6c2a8e-3a52-4c1e-9d1a-2b3c4d5e6f72';

const custom: PolicyDocument[] = [
  { statements: [{ effect: 'deny', permissions: ['*'], spaces: [HR] }] },
  { statements: [{ effect: 'deny', permissions: ['task.update'], notSpaces: [OPS] }] },
  { statements: [{ effect: 'deny', permissions: ['roles.*'] }] },
];

describe('explainPermission', () => {
  it('always agrees with the real evaluation, for every permission, space and policy mix', () => {
    const mixes: PolicyDocument[][] = [
      ...MANAGED_POLICIES.map((policy) => [policy.document]),
      ...MANAGED_POLICIES.flatMap((policy) => custom.map((extra) => [policy.document, extra])),
    ];
    for (const documents of mixes) {
      const access = evaluatePolicies(documents);
      const labelled = documents.map((document, index) => ({ source: `p${index}`, document }));
      for (const permission of PERMISSIONS) {
        for (const space of [null, HR, OPS]) {
          const real = space ? canInSpace(access, space, permission) : access.permissions.includes(permission);
          expect(explainPermission(labelled, permission, space).allowed, `${permission} in ${space}`).toBe(real);
        }
      }
    }
  });

  it('says which statement decided, and how', () => {
    const contributor = MANAGED_POLICIES.find((policy) => policy.key === 'Contributor')!.document;
    const policies = [
      { source: 'Managed policy “Contributor”', document: contributor },
      { source: 'Policy “Hide HR”', document: custom[0]! },
    ];
    expect(explainPermission(policies, 'task.update', OPS)).toMatchObject({ allowed: true, verdict: 'allowed', reasons: [{ effect: 'allow', source: 'Managed policy “Contributor”', pattern: 'task.update' }, { effect: 'deny', scope: 'other-spaces' }] });
    expect(explainPermission(policies, 'task.update', HR)).toMatchObject({ allowed: false, verdict: 'denied-in-space' });
    expect(explainPermission(policies, 'roles.manage', null)).toMatchObject({ allowed: false, verdict: 'not-granted', reasons: [] });
    const denied = explainPermission([...policies, { source: 'Policy “No roles”', document: custom[2]! }, { source: 'All', document: { statements: [{ effect: 'allow', permissions: ['*'] }] } }], 'roles.manage', null);
    expect(denied).toMatchObject({ allowed: false, verdict: 'denied' });
    expect(denied.reasons.find((reason) => reason.effect === 'deny')).toMatchObject({ source: 'Policy “No roles”', pattern: 'roles.*' });
  });
});

import { flowActions, validateFlowShape } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';
import { AUTOMATION_TEMPLATES } from './templates';

describe('automation templates', () => {
  it('are well-formed flows with at least one action', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      expect(validateFlowShape(template.flow), template.id).toEqual([]);
      expect(flowActions(template.flow).length, template.id).toBeGreaterThan(0);
    }
  });
});

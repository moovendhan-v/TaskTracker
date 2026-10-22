import { describe, expect, it } from 'vitest';
import { POSITION_STEP, positionBetween } from './task-meta';

describe('positionBetween', () => {
  it('starts an empty column at one step', () => expect(positionBetween(undefined, undefined)).toBe(POSITION_STEP));
  it('goes before the first card', () => expect(positionBetween(undefined, 2048)).toBe(1024));
  it('goes after the last card', () => expect(positionBetween(2048, undefined)).toBe(3072));
  it('goes halfway between neighbours', () => expect(positionBetween(1024, 2048)).toBe(1536));
});

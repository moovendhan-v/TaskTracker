import { describe, expect, it } from 'vitest';
import { POSITION_STEP, positionBetween, formatPoints, parseStoryPoints } from './task-meta';

describe('positionBetween', () => {
  it('starts an empty column at one step', () => expect(positionBetween(undefined, undefined)).toBe(POSITION_STEP));
  it('goes before the first card', () => expect(positionBetween(undefined, 2048)).toBe(1024));
  it('goes after the last card', () => expect(positionBetween(2048, undefined)).toBe(3072));
  it('goes halfway between neighbours', () => expect(positionBetween(1024, 2048)).toBe(1536));
});

describe('story points', () => {
  it('reads what was typed as a whole number from 0 to 100, or empty', () => {
    expect(parseStoryPoints('')).toBeNull();
    expect(parseStoryPoints('  ')).toBeNull();
    expect(parseStoryPoints('5')).toBe(5);
    expect(parseStoryPoints('2.6')).toBe(3);
    expect(parseStoryPoints('-4')).toBe(0);
    expect(parseStoryPoints('400')).toBe(100);
    expect(parseStoryPoints('abc')).toBeNull();
    expect(formatPoints(1)).toBe('1 pt');
    expect(formatPoints(8)).toBe('8 pts');
  });
});

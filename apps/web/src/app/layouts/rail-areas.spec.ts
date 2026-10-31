import { describe, expect, it } from 'vitest';
import { goToPath, railAreaOf } from './rail-areas';

const WS = '/w/11111111-1111-4111-8111-111111111111';

describe('rail areas', () => {
  it('maps pages to their rail app', () => {
    expect(railAreaOf(WS)).toBe('home');
    expect(railAreaOf(`${WS}/`)).toBe('home');
    expect(railAreaOf(`${WS}/p/x/board`)).toBe('tracker');
    expect(railAreaOf(`${WS}/l/x`)).toBe('tracker');
    expect(railAreaOf(`${WS}/sprints/x`)).toBe('tracker');
    expect(railAreaOf(`${WS}/docs/x`)).toBe('docs');
    expect(railAreaOf(`${WS}/daily-log`)).toBe('time');
    expect(railAreaOf(`${WS}/people/time-off`)).toBe('people');
    expect(railAreaOf(`${WS}/roles`)).toBe('workspace');
    expect(railAreaOf(`${WS}/inbox`)).toBeNull();
    expect(railAreaOf(`${WS}/sprintsx`)).toBeNull();
  });

  it('resolves G-shortcuts', () => {
    expect(goToPath('h')).toBe('');
    expect(goToPath('i')).toBe('/inbox');
    expect(goToPath('t')).toBe('/my-tasks');
    expect(goToPath('z')).toBeNull();
  });
});

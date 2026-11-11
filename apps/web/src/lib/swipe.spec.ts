import { describe, expect, it } from 'vitest';
import { swipeDismisses, swipeOffset } from './swipe';

describe('swipeDismisses', () => {
  it('closes after a long enough swipe in its direction', () => {
    expect(swipeDismisses('down', 5, 120, 400)).toBe(true);
    expect(swipeDismisses('left', -100, 10, 400)).toBe(true);
    expect(swipeDismisses('right', 100, -5, 400)).toBe(true);
  });

  it('closes after a short, quick flick', () => {
    expect(swipeDismisses('down', 0, 40, 50)).toBe(true);
    expect(swipeDismisses('down', 0, 40, 400)).toBe(false);
  });

  it('springs back from the wrong way, or mostly sideways', () => {
    expect(swipeDismisses('down', 0, -120, 300)).toBe(false);
    expect(swipeDismisses('left', 100, 0, 300)).toBe(false);
    expect(swipeDismisses('down', 150, 100, 300)).toBe(false);
  });
});

describe('swipeOffset', () => {
  it('follows the finger along the direction only, never backwards', () => {
    expect(swipeOffset('down', 30, 50)).toEqual({ x: 0, y: 50 });
    expect(swipeOffset('down', 0, -20)).toEqual({ x: 0, y: 0 });
    expect(swipeOffset('left', -40, 10)).toEqual({ x: -40, y: 0 });
    expect(swipeOffset('right', -40, 0)).toEqual({ x: 0, y: 0 });
  });
});

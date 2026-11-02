import { describe, expect, it } from 'vitest';
import { CHAT_MESSAGE_MAX, cleanMessageBody, isValidChannelName, normalizeChannelName, taskTitleFromMessage } from '@taskflow/shared-types';

describe('chat rules', () => {
  it('normalises channel names', () => {
    expect(normalizeChannelName('  #Sprint 14 Planning!  ')).toBe('sprint-14-planning');
    expect(normalizeChannelName('ops.alerts')).toBe('ops-alerts');
    expect(normalizeChannelName('--Design__Team--')).toBe('design__team');
    expect(normalizeChannelName('a'.repeat(100))).toHaveLength(80);
  });

  it('validates channel names', () => {
    expect(isValidChannelName('platform')).toBe(true);
    expect(isValidChannelName('web-2_ops')).toBe(true);
    expect(isValidChannelName('')).toBe(false);
    expect(isValidChannelName('-lead')).toBe(false);
    expect(isValidChannelName('Upper')).toBe(false);
    expect(isValidChannelName('has space')).toBe(false);
    expect(isValidChannelName('a'.repeat(81))).toBe(false);
  });

  it('trims message bodies and rejects empty or long ones', () => {
    expect(cleanMessageBody('  hi  ')).toBe('hi');
    expect(cleanMessageBody(' \n ')).toBeNull();
    expect(cleanMessageBody('x'.repeat(CHAT_MESSAGE_MAX))).not.toBeNull();
    expect(cleanMessageBody('x'.repeat(CHAT_MESSAGE_MAX + 1))).toBeNull();
  });

  it('takes a task title from the first line of a message', () => {
    expect(taskTitleFromMessage('\n  **Fix** the `login` crash\nmore detail')).toBe('Fix the login crash');
    expect(taskTitleFromMessage('> quoted idea')).toBe('quoted idea');
    expect(taskTitleFromMessage('y'.repeat(300))).toHaveLength(200);
  });
});

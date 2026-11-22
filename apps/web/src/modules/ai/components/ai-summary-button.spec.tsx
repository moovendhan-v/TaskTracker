import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiSummaryButton } from './ai-summary-button';

const state = vi.hoisted(() => ({ enabled: false, mutate: vi.fn(), data: undefined as unknown }));
vi.mock('../hooks/use-ai', () => ({
  useAiSettings: () => ({ data: { enabled: state.enabled } }),
  useSummarize: () => ({ mutate: state.mutate, data: state.data, isPending: false }),
}));

describe('AiSummaryButton', () => {
  afterEach(() => {
    cleanup();
    state.mutate.mockReset();
  });

  it('is hidden while the workspace has AI off', () => {
    state.enabled = false;
    render(<AiSummaryButton workspaceId="w" target={{ kind: 'task', taskId: 't' }} what="this task" />);
    expect(screen.queryByRole('button', { name: /with AI/ })).toBeNull();
  });

  it('asks for a summary when opened and shows the answer as text, never HTML', () => {
    state.enabled = true;
    state.data = { text: '- Fixed <img src=x onerror=alert(1)>\n- Ships Friday', providerLabel: 'Gemini', model: 'gemini-2.5-flash', tokens: 120, usedToday: 120, dailyTokens: 200000 };
    render(<AiSummaryButton workspaceId="w" target={{ kind: 'task', taskId: 't' }} what="this task" />);
    fireEvent.click(screen.getByRole('button', { name: 'Summarise this task with AI' }));
    const text = screen.getByTestId('ai-summary');
    expect(text.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(text.querySelector('img')).toBeNull();
    expect(screen.getByText(/Gemini · gemini-2.5-flash/)).toBeTruthy();
  });
});

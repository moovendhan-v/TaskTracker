import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownPreview } from './markdown-preview';

// Without a workspace (no DocTasksProvider) task references render as plain text,
// so this checks the parsing and sanitising without any network.
describe('MarkdownPreview task references', () => {
  it('turns #123 into a task reference and leaves headings, links and code alone', () => {
    const { container } = render(<MarkdownPreview content={'# Plan\n\nFix #12 first. See [docs](https://example.com/#12) and `#99`.'} />);
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeTruthy();
    expect(container.textContent).toContain('Fix #12 first');
    // The mention is not left as a link; the real link keeps its href.
    const links = [...container.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['https://example.com/#12']);
    expect(container.querySelector('code')?.textContent).toBe('#99');
  });

  it('renders :::task and :::tasks blocks, and keeps other text around them', () => {
    const { container } = render(<MarkdownPreview content={'Before\n\n:::task 7\n:::\n\n:::tasks overdue limit=3\n:::\n\nAfter'} />);
    expect(container.textContent).toContain('Task #7');
    expect(container.textContent).toContain('Overdue tasks');
    expect(container.textContent).toContain('Before');
    expect(container.textContent).toContain('After');
    expect(container.textContent).not.toContain(':::');
  });

  it('shows an unknown list preset as text instead of running anything', () => {
    const { container } = render(<MarkdownPreview content={':::tasks everything-secret\n:::'} />);
    expect(container.textContent).toContain(':::tasks everything-secret');
  });
});

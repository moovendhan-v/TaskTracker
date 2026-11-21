import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PullRequestSummary } from './pull-request-summary';

describe('PullRequestSummary', () => {
  afterEach(cleanup);

  it('shows a dash with no pull requests', () => {
    render(<PullRequestSummary summary={null} />);
    expect(screen.getByText('–')).toBeTruthy();
  });

  it('leads with open, then merged, then closed, and counts the rest', () => {
    const { container, rerender } = render(<PullRequestSummary summary={{ open: 2, merged: 1, closed: 0 }} />);
    expect(screen.getByText('2 open')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe('Pull requests: 2 open, 1 merged');
    rerender(<PullRequestSummary summary={{ open: 0, merged: 1, closed: 1 }} />);
    expect(screen.getByText('Merged')).toBeTruthy();
    rerender(<PullRequestSummary summary={{ open: 0, merged: 0, closed: 1 }} />);
    expect(screen.getByText('Closed')).toBeTruthy();
  });
});

import { describe, expect, it } from 'vitest';
import { highlight } from './highlight';

describe('highlight', () => {
  it('marks words that start with a searched word', () => {
    expect(highlight('Deploy failed on deployment-2', 'depl')).toEqual([
      { text: 'Deploy', hit: true },
      { text: ' failed on ', hit: false },
      { text: 'deployment', hit: true },
      { text: '-2', hit: false },
    ]);
    expect(highlight('no match here', '')).toEqual([{ text: 'no match here', hit: false }]);
  });
});

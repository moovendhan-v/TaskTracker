import { describe, expect, it } from 'vitest';
import { namesToTokens, personAt, tokensToNames } from './mentions';

describe('chat mentions in the composer', () => {
  it('finds the name being typed', () => {
    expect(personAt('hey @jor', 8)).toEqual({ start: 4, query: 'jor' });
    expect(personAt('@', 1)).toEqual({ start: 0, query: '' });
    expect(personAt('mail me@example', 15)).toBeNull();
    expect(personAt('hey @jor and more', 17)).toBeNull();
  });

  it('turns picked names into tokens, longest name first', () => {
    const people = [
      { id: 'u1', name: 'Sam' },
      { id: 'u2', name: 'Sam Rivera' },
    ];
    expect(namesToTokens('@Sam Rivera and @Sam, not @Samuel', people)).toBe('@{u2} and @{u1}, not @Samuel');
    expect(namesToTokens('cost is $5 (@Sam)', people)).toBe('cost is $5 (@{u1})');
  });

  it('turns tokens back into names for editing', () => {
    expect(tokensToNames('hi @{u1} and @{u9}', (id) => (id === 'u1' ? 'Sam' : null))).toEqual({
      text: 'hi @Sam and @someone',
      people: [
        { id: 'u1', name: 'Sam' },
        { id: 'u9', name: 'someone' },
      ],
    });
  });
});

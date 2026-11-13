import { describe, expect, it } from 'vitest';
import { parseSlides } from './slides';

describe('parseSlides', () => {
  it('splits at --- lines and titles each slide by its first heading', () => {
    const slides = parseSlides('# One\n\nIntro\n\n---\n\n## Two\n\nMore\n---\nPlain', 'Deck');
    expect(slides.map((slide) => slide.title)).toEqual(['One', 'Two', 'Slide 3']);
    expect(slides[1]!.content).toBe('## Two\n\nMore');
  });

  it('keeps speaker notes out of the slide', () => {
    const [slide] = parseSlides('# Status\n\n- Shipped #12\n\nNotes:\nMention :::task 12 and #14\n\n:::task 14', 'Deck');
    expect(slide!.content).toBe('# Status\n\n- Shipped #12');
    expect(slide!.notes).toBe('Mention :::task 12 and #14\n\n:::task 14');
  });

  it('takes notes on the same line as Note:, in any case', () => {
    const [slide] = parseSlides('# Hi\n\nnote: say hello to #3', 'Deck');
    expect(slide!.content).toBe('# Hi');
    expect(slide!.notes).toBe('say hello to #3');
  });

  it("doesn't take a word that merely starts with Note as notes", () => {
    const [slide] = parseSlides('# Hi\n\nNoteworthy: this stays', 'Deck');
    expect(slide!.notes).toBe('');
    expect(slide!.content).toContain('Noteworthy');
  });

  it('gives an empty page one title slide', () => {
    expect(parseSlides('  ', 'Deck')).toEqual([{ id: 0, content: '# Deck\n\nNo presentation slides yet.', notes: '', title: 'Deck' }]);
  });
});

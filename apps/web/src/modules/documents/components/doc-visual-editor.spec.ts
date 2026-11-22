import { describe, expect, it } from 'vitest';
import { blocksToMarkdown, markdownToBlocks } from './doc-visual-editor';

describe('visual editor and md2slides Markdown', () => {
  it('keeps md2slides blocks it does not model exactly as written (and never hangs on them)', () => {
    const deck = [
      ':::chart style=donut 2.8M',
      '- Web | 42',
      '- iOS | 30',
      ':::',
      ':::cards style=glass cols=3',
      '- rocket | Fast | Ships today',
      ':::',
      ':::flow style=pipeline',
      '- code | Build | 4 min',
      ':::',
      '### Left',
      '|||',
      '### Right',
    ].join('\n');
    const blocks = markdownToBlocks(deck);
    expect(blocks.filter((block) => block.type === 'raw').map((block) => block.content.split('\n')[0])).toEqual([':::chart style=donut 2.8M', ':::cards style=glass cols=3', ':::flow style=pipeline', '|||']);
    const again = blocksToMarkdown(blocks);
    for (const line of deck.split('\n')) expect(again).toContain(line);
    expect(markdownToBlocks(again).map((block) => block.type)).toEqual(blocks.map((block) => block.type));
  });

  it('still edits the simple cards, stats and timeline forms as blocks', () => {
    expect(markdownToBlocks(':::cards cols=2\n- 🚀 Speed | Fast\n:::\n:::stats\n- 99% | Uptime | SLA\n:::\n:::timeline\n- Q1 | Plan | Start\n:::').map((block) => block.type)).toEqual(['cards', 'stats', 'timeline']);
  });

  it('moves on from any line no rule takes', () => {
    expect(markdownToBlocks(':::\n#tag\nplain').map((block) => block.type)).toEqual(['raw', 'raw', 'paragraph']);
  });
});

import { describe, expect, it } from 'vitest';
import { blocksToMarkdown, markdownToBlocks } from '../components/doc-visual-editor';

describe('visual editor and task blocks', () => {
  it('reads task blocks into their own block types and writes them back unchanged', () => {
    const md = 'Intro mentions #3.\n\n:::task 7\n:::\n\n:::tasks overdue limit=3\n:::\n\nOutro';
    const blocks = markdownToBlocks(md);
    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'task', 'tasks', 'paragraph']);
    expect(blocks[1]!.meta).toMatchObject({ taskNumber: 7 });
    expect(blocks[2]!.meta).toMatchObject({ taskPreset: 'overdue', taskLimit: 3 });
    const back = blocksToMarkdown(blocks);
    expect(back).toContain(':::task 7\n:::');
    expect(back).toContain(':::tasks overdue limit=3\n:::');
    expect(back).toContain('Intro mentions #3.');
    expect(markdownToBlocks(back).map((block) => block.type)).toEqual(['paragraph', 'task', 'tasks', 'paragraph']);
  });

  it('leaves out a task card that has no number yet', () => {
    expect(blocksToMarkdown([{ id: 'a', type: 'task', content: '', meta: { taskNumber: null } }])).not.toContain(':::task');
  });
});

import { describe, expect, it } from 'vitest';
import { readTflow, tflowFileName } from './tflow';

const file = (body: unknown, name = 'x.tflow') => new File([typeof body === 'string' ? body : JSON.stringify(body)], name, { type: 'application/json' });

describe('.tflow files', () => {
  it('names files safely', () => {
    expect(tflowFileName('Sprint health / Q4!')).toBe('sprint-health-q4.tflow');
    expect(tflowFileName('***')).toBe('taskflow.tflow');
  });

  it('reads the expected kind and refuses others', async () => {
    const layout = await readTflow(file({ kind: 'dashboard-layout', version: 1, name: 'Ops', payload: { items: [] } }), 'dashboard-layout');
    expect(layout).toMatchObject({ name: 'Ops', payload: { items: [] } });
    await expect(readTflow(file({ kind: 'project-template', version: 1, name: 'T', payload: {} }), 'dashboard-layout')).rejects.toThrow(/isn’t a dashboard layout/);
    await expect(readTflow(file({ kind: 'dashboard-layout', version: 2, payload: {} }), 'dashboard-layout')).rejects.toThrow(/newer TaskFlow/);
    await expect(readTflow(file('{nope'), 'dashboard-layout')).rejects.toThrow(/not valid JSON/);
  });

  it('accepts older template files through the legacy reader', async () => {
    const old = await readTflow(file({ name: 'Old', content: { version: 1 } }, 'old.taskflow-template.json'), 'project-template', (raw) => raw['content']);
    expect(old).toMatchObject({ name: 'Old', payload: { version: 1 } });
  });
});

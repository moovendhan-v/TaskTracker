import { ANNOTATION_COLORS, canvasToPng, drawAnnotation, parseUserAgent, renderAnnotated, startRecording, type Annotation, type AnnotationTool, type Point, type Recording } from '@taskflow/bug-capture';
import {
  BUG_ENVIRONMENT_LABELS,
  BUG_ENVIRONMENTS,
  BUG_KIND_LABELS,
  BUG_KINDS,
  BUG_LIMITS,
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
  isFailedRequest,
  redactUrl,
  type ExtensionSessionResponse,
} from '@taskflow/shared-types';
import { api, NotConnectedError } from './api.js';
import { ext } from './browser.js';
import { getConnection } from './config.js';
import type { Draft } from './draft.js';
import { h, render } from './dom.js';

const app = document.getElementById('app')!;
const LAST_PROJECT = 'lastProject';
const TOOLS: [AnnotationTool, string][] = [
  ['arrow', '↗ Arrow'],
  ['rect', '▭ Box'],
  ['highlight', '▮ Highlight'],
  ['pen', '✎ Draw'],
  ['text', 'T Text'],
  ['blur', '▦ Hide'],
];

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

function fail(text: string) {
  render(app, h('header', {}, h('h1', {}, 'Report a bug')), h('p', { class: 'error', role: 'alert' }, text));
}

async function main(): Promise<void> {
  const id = new URLSearchParams(location.search).get('draft') ?? '';
  const draft = (await ext.storage.session.get(`draft:${id}`))[`draft:${id}`] as Draft | undefined;
  if (!draft) return fail('This report was already filed or has expired. Start again from the extension.');
  const connection = await getConnection();
  if (!connection) return fail('The extension is not connected to TaskFlow. Open the extension and connect it.');
  let session: ExtensionSessionResponse;
  try {
    session = await api.session();
  } catch (error) {
    return fail(error instanceof NotConnectedError ? 'This connection was disconnected or expired. Connect again from the extension.' : error instanceof Error ? error.message : 'TaskFlow can’t be reached');
  }
  if (!session.projects.length) return fail('There’s no project in this workspace you can file into.');

  // ── Screenshot and annotations ────────────────────────────────────────────
  const image = await loadImage(draft.screenshot);
  const canvas = h('canvas', { 'aria-label': 'Screenshot (draw on it to point at the problem)' });
  const annotations: Annotation[] = [];
  if (draft.element) {
    // The picked element, boxed already (the screenshot is in device pixels).
    const ratio = draft.devicePixelRatio || 1;
    const { x, y, width, height } = draft.element.rect;
    annotations.push({ tool: 'rect', color: ANNOTATION_COLORS[0], from: { x: x * ratio - 4, y: y * ratio - 4 }, to: { x: (x + width) * ratio + 4, y: (y + height) * ratio + 4 } });
  }
  let tool: AnnotationTool = 'arrow';
  let color: string = ANNOTATION_COLORS[0];
  let draftShape: Annotation | null = null;
  let includeScreenshot = true;
  const redraw = () => {
    renderAnnotated(canvas, image, annotations);
    if (draftShape) drawAnnotation(canvas.getContext('2d')!, draftShape);
  };
  const point = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  };
  const textInput = h('input', { type: 'text', placeholder: 'Text, then click the image', maxlength: 120, 'aria-label': 'Text to place', style: 'width: 200px; display: none' });
  canvas.addEventListener('pointerdown', (event) => {
    const at = point(event);
    if (tool === 'text') {
      if (textInput.value.trim()) annotations.push({ tool: 'text', color, at, text: textInput.value.trim() });
      redraw();
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    draftShape = tool === 'pen' ? { tool: 'pen', color, points: [at] } : { tool, color, from: at, to: at };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!draftShape) return;
    const at = point(event);
    if (draftShape.tool === 'pen') draftShape.points.push(at);
    else if (draftShape.tool !== 'text') draftShape.to = at;
    redraw();
  });
  const finishShape = () => {
    if (draftShape) annotations.push(draftShape);
    draftShape = null;
    redraw();
  };
  canvas.addEventListener('pointerup', finishShape);
  canvas.addEventListener('pointercancel', finishShape);
  redraw();

  const toolButtons = TOOLS.map(([value, label]) => {
    const button = h('button', { type: 'button', class: 'icon', 'aria-pressed': String(value === tool), onclick: () => {
      tool = value;
      toolButtons.forEach((other, index) => other.setAttribute('aria-pressed', String(TOOLS[index]![0] === tool)));
      textInput.style.display = tool === 'text' ? '' : 'none';
    } }, label);
    return button;
  });
  const swatches = ANNOTATION_COLORS.map((value) => {
    const swatch = h('button', { type: 'button', class: 'swatch', style: `background:${value}`, 'aria-label': `Colour ${value}`, 'aria-pressed': String(value === color), onclick: () => {
      color = value;
      swatches.forEach((other) => other.setAttribute('aria-pressed', String(other === swatch)));
    } });
    return swatch;
  });

  // ── Form ──────────────────────────────────────────────────────────────────
  const stored = (await ext.storage.local.get(LAST_PROJECT))[LAST_PROJECT] as string | undefined;
  const select = (id: string, options: [string, string][], value: string) => h('select', { id }, ...options.map(([option, label]) => h('option', { value: option, ...(option === value ? { selected: true } : {}) }, label)));
  const project = select('project', session.projects.map((item) => [item.id, item.name]), session.projects.some((item) => item.id === stored) ? stored! : session.projects[0]!.id);
  const title = h('input', { type: 'text', id: 'title', maxlength: BUG_LIMITS.title, placeholder: 'What went wrong?', value: draft.element ? `Problem with “${draft.element.description}”` : '' });
  const kind = select('kind', BUG_KINDS.map((value) => [value, BUG_KIND_LABELS[value]]), 'bug');
  const severity = select('severity', BUG_SEVERITIES.map((value) => [value, BUG_SEVERITY_LABELS[value]]), 'P2');
  const environment = select('environment', BUG_ENVIRONMENTS.map((value) => [value, BUG_ENVIRONMENT_LABELS[value]]), /localhost|127\.0\.0\.1|\.local\b|dev\./.test(draft.pageUrl ?? '') ? 'development' : /staging|stage\./.test(draft.pageUrl ?? '') ? 'staging' : 'production');
  const expected = h('textarea', { id: 'expected', maxlength: BUG_LIMITS.text });
  const actual = h('textarea', { id: 'actual', maxlength: BUG_LIMITS.text });
  const steps = h('textarea', { id: 'steps', placeholder: 'One step per line (recorded clicks are added too)' });
  const capture = draft.capture;
  const errors = capture?.console?.filter((entry) => entry.level === 'error').length ?? 0;
  const failed = capture?.network?.filter(isFailedRequest).length ?? 0;
  const diagnostics = h('input', { type: 'checkbox', id: 'diagnostics', checked: Boolean(capture) });
  const similarBox = h('div', { role: 'status' });
  const status = h('p', { class: 'small', role: 'status' });
  const mic = h('input', { type: 'checkbox', id: 'mic' });
  const recordInfo = h('span', { class: 'small muted' });
  let video: Blob | null = null;
  let recording: Recording | null = null;
  const recordBar = h('div', { class: 'recording', style: 'display:none', role: 'status' });

  let similarTimer = 0;
  const checkSimilar = () => {
    window.clearTimeout(similarTimer);
    const lookUp = async () => {
      const text = title.value.trim();
      if (text.length < 4) return render(similarBox);
      const similar = await api.similar(project.value, text).catch(() => []);
      render(
        similarBox,
        similar.length
          ? h('div', { class: 'warn small' }, h('strong', {}, 'Similar reports already exist'), ...similar.map((bug) => h('p', {}, `#${bug.number} ${bug.title} · ${Math.round(bug.score * 100)}% alike`)))
          : null,
      );
    };
    similarTimer = window.setTimeout(() => void lookUp(), 500);
  };
  title.addEventListener('input', checkSimilar);
  project.addEventListener('change', checkSimilar);
  checkSimilar();

  const record = async () => {
    try {
      recording = await startRecording({
        microphone: mic.checked,
        onTick: (seconds) => render(recordBar, h('span', { class: 'dot live' }), `Recording ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} / 1:00`, h('button', { type: 'button', onclick: () => void recording?.stop() }, 'Stop')),
      });
      recordBar.style.display = 'flex';
      video = await recording.ended;
      render(recordInfo, `Recording attached (${(video.size / 1024 / 1024).toFixed(1)} MB) `, h('button', { type: 'button', class: 'link', onclick: () => {
        video = null;
        render(recordInfo);
      } }, 'Remove'));
    } catch (error) {
      if (!(error instanceof Error) || !/cancel|NotAllowed|Permission/i.test(`${error.name} ${error.message}`)) render(recordInfo, h('span', { class: 'error' }, error instanceof Error ? error.message : 'Recording failed'));
    } finally {
      recording = null;
      recordBar.style.display = 'none';
    }
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    if (!title.value.trim()) {
      render(status, h('span', { class: 'error' }, 'Give the report a title'));
      title.focus();
      return;
    }
    if (video && video.size > 10 * 1024 * 1024) {
      render(status, h('span', { class: 'error' }, 'The recording is over 10 MB. Record a shorter clip.'));
      return;
    }
    const button = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    if (button) button.disabled = true;
    try {
      render(status, 'Filing…');
      await ext.storage.local.set({ [LAST_PROJECT]: project.value });
      const { browser, os } = parseUserAgent(draft.userAgent);
      const manual = steps.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, BUG_LIMITS.steps);
      if (draft.element) manual.push(`Look at “${draft.element.description}” (${draft.element.selector})`.slice(0, BUG_LIMITS.stepText));
      const bug = await api.report({
        spaceId: project.value,
        title: title.value.trim(),
        kind: kind.value as never,
        severity: severity.value as never,
        environment: environment.value as never,
        expected: expected.value.trim() || null,
        actual: actual.value.trim() || null,
        steps: manual,
        context: { pageUrl: draft.pageUrl ? redactUrl(draft.pageUrl) : null, browser, os, viewport: draft.viewport, userAgent: draft.userAgent.slice(0, 500) },
        captureJson: diagnostics.checked && capture ? JSON.stringify(capture) : null,
      });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const problems: string[] = [];
      if (includeScreenshot) {
        render(status, 'Uploading the screenshot…');
        const result = await api.upload(bug.taskId, await canvasToPng(canvas), `screenshot-${stamp}.png`).catch((error: unknown) => ({ attachment: null, error: error instanceof Error ? error.message : 'failed' }));
        if (result.error) problems.push(`screenshot: ${result.error}`);
      }
      if (video) {
        render(status, 'Uploading the recording…');
        const result = await api.upload(bug.taskId, video, `recording-${stamp}.${video.type.includes('mp4') ? 'mp4' : 'webm'}`).catch((error: unknown) => ({ attachment: null, error: error instanceof Error ? error.message : 'failed' }));
        if (result.error) problems.push(`recording: ${result.error}`);
      }
      await ext.storage.session.remove(`draft:${draft.id}`);
      const link = `${connection.server}${bug.url}`;
      render(
        app,
        h('header', {}, h('h1', { class: 'ok' }, `Filed #${bug.number}`)),
        h(
          'div',
          { class: 'stack', style: 'grid-column: 1 / -1' },
          h('p', {}, bug.title),
          problems.length ? h('p', { class: 'error' }, `Some files didn’t upload (${problems.join('; ')}). Add them on the task.`) : null,
          h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => void ext.tabs.create({ url: link }) }, 'Open in TaskFlow'), h('button', { onclick: () => window.close() }, 'Close')),
        ),
      );
    } catch (error) {
      if (button) button.disabled = false;
      render(status, h('span', { class: 'error' }, error instanceof NotConnectedError ? 'The connection was disconnected. Connect again from the extension, then file.' : error instanceof Error ? error.message : 'Filing failed'));
    }
  };

  const screenshotToggle = h('input', { type: 'checkbox', id: 'include-screenshot', checked: true, onchange: (event: Event) => {
    includeScreenshot = (event.target as HTMLInputElement).checked;
    canvas.style.opacity = includeScreenshot ? '1' : '0.35';
  } });

  render(
    app,
    h('header', {}, h('h1', { class: 'grow' }, 'Report a bug'), h('span', { class: 'muted small' }, `${session.workspace.name} · ${session.user.name}`)),
    h(
      'section',
      { class: 'stack', 'aria-label': 'Screenshot' },
      h('div', { class: 'row', role: 'toolbar', 'aria-label': 'Annotation tools' }, ...toolButtons, textInput, h('span', { style: 'width: 8px' }), ...swatches, h('span', { class: 'grow' }), h('button', { type: 'button', class: 'icon', onclick: () => {
        annotations.pop();
        redraw();
      } }, '↶ Undo')),
      h('div', { class: 'canvas-wrap' }, canvas),
      h('label', { class: 'row small' }, screenshotToggle, 'Attach the screenshot'),
      h('p', { class: 'muted small' }, draft.pageTitle ? `${draft.pageTitle} · ` : '', draft.pageUrl ? redactUrl(draft.pageUrl) : ''),
    ),
    h(
      'form',
      { class: 'stack', onsubmit: submit, novalidate: true },
      h('label', { class: 'field', for: 'project' }, 'Project', project),
      h('label', { class: 'field', for: 'title' }, 'Title', title),
      similarBox,
      h('div', { class: 'grid2' }, h('label', { class: 'field', for: 'kind' }, 'Kind', kind), h('label', { class: 'field', for: 'severity' }, 'Severity', severity)),
      h('label', { class: 'field', for: 'environment' }, 'Environment', environment),
      h('label', { class: 'field', for: 'expected' }, 'Expected result', expected),
      h('label', { class: 'field', for: 'actual' }, 'Actual result', actual),
      h('label', { class: 'field', for: 'steps' }, 'Steps to reproduce', steps),
      h('div', { class: 'card stack' }, h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => void record() }, '⏺ Record the screen'), h('label', { class: 'row small' }, mic, 'with microphone')), recordInfo),
      capture
        ? h('label', { class: 'row small' }, diagnostics, h('span', { class: 'grow' }, 'Include diagnostics: ', `${count(capture.console?.length ?? 0, 'console line')} (${count(errors, 'error')}), ${count(capture.network?.length ?? 0, 'request')} (${failed} failed), ${count(capture.actions?.length ?? 0, 'action')}. Passwords, tokens and cookies are removed.`))
        : h('p', { class: 'muted small' }, 'No console or network was captured on that page. Next time, press “Capture console & network on this tab” before reproducing the bug.'),
      h('button', { class: 'primary', type: 'submit' }, 'File report'),
      status,
    ),
    recordBar,
  );
  title.focus();
}

void main().catch((error: unknown) => fail(error instanceof Error ? error.message : 'Something went wrong'));

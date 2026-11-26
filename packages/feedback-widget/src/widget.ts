import { CaptureRecorder, captureScreenshot, canCaptureScreen, detectEnvironment } from '@taskflow/bug-capture';
import { BUG_LIMITS, type PublicIntakeConfig, type PublicReportResponse } from '@taskflow/shared-types';
import { STYLES } from './styles.js';

/**
 * TaskFlow feedback widget. Add to any page:
 *
 *   <script src="https://taskflow.example.com/embed/v1/feedback.js" data-key="tfk_…" async></script>
 *
 * Options (data- attributes): data-label ("Feedback"), data-position ("right" | "left"),
 * data-color (a CSS colour), data-capture ("off" to not record console and network).
 * API: window.TaskFlowFeedback.open() / .close().
 *
 * The site's console, errors, failed requests and clicks are recorded in memory from load (redacted
 * as they're recorded) and sent only with a report the visitor files. Everything renders in a
 * shadow root, so the page's styles and the widget's don't mix. No cookies, no third parties
 * (Cloudflare Turnstile only when the TaskFlow server requires a CAPTCHA).
 */

interface Options {
  server: string;
  key: string;
  label: string;
  position: 'left' | 'right';
  color: string | null;
  capture: boolean;
}

interface Turnstile {
  render(container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; theme?: string }): string;
  reset(id: string): void;
}

const SCRIPT = document.currentScript as HTMLScriptElement | null;
const MAX_SCREENSHOT = 650_000;

function readOptions(): Options | null {
  if (!SCRIPT?.src) return null;
  const key = SCRIPT.dataset['key']?.trim() ?? '';
  if (!/^tfk_[A-Za-z0-9_-]{32}$/.test(key)) {
    console.warn('[TaskFlow feedback] data-key is missing or not a TaskFlow project key');
    return null;
  }
  const color = SCRIPT.dataset['color']?.trim() ?? '';
  return {
    server: new URL(SCRIPT.src).origin,
    key,
    label: (SCRIPT.dataset['label']?.trim() || 'Feedback').slice(0, 30),
    position: SCRIPT.dataset['position'] === 'left' ? 'left' : 'right',
    // Only plain colour values, never arbitrary CSS.
    color: /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%]+\))$/i.test(color) ? color : null,
    capture: SCRIPT.dataset['capture'] !== 'off',
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string | boolean | undefined> = {}, ...children: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (name === 'class') element.className = String(value);
    else element.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) if (child !== null) element.append(child);
  return element;
}

/** A screenshot small enough for one request: JPEG, at most 1600 px wide. */
async function shrink(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  for (const [width, quality] of [[1600, 0.78], [1280, 0.7], [1024, 0.6]] as const) {
    const scale = Math.min(1, width / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length * 0.75 <= MAX_SCREENSHOT) return url;
  }
  throw new Error('The screenshot is too large');
}

let turnstileLoading: Promise<Turnstile> | null = null;
function loadTurnstile(): Promise<Turnstile> {
  const existing = (window as unknown as { turnstile?: Turnstile }).turnstile;
  if (existing) return Promise.resolve(existing);
  turnstileLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve((window as unknown as { turnstile: Turnstile }).turnstile);
    script.onerror = () => reject(new Error('The CAPTCHA could not load'));
    document.head.append(script);
  });
  return turnstileLoading;
}

async function start(options: Options): Promise<void> {
  const base = `${options.server}/api/public/intake/${options.key}`;
  const recorder = options.capture ? new CaptureRecorder({ bodies: 'failed', ignoreUrls: [new RegExp(`^${options.server.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}/api/public/`)] }).start() : null;

  let config: PublicIntakeConfig;
  try {
    const response = await fetch(base, { credentials: 'omit' });
    if (!response.ok) throw new Error(String(response.status));
    config = (await response.json()) as PublicIntakeConfig;
  } catch {
    recorder?.stop();
    console.warn('[TaskFlow feedback] this project’s feedback widget is off or the key is wrong');
    return;
  }
  if (!config.widget) {
    recorder?.stop();
    return;
  }

  const host = el('div', { 'data-bug-capture-ignore': true, 'data-taskflow-feedback': true });
  const root = host.attachShadow({ mode: 'open' });
  const style = el('style');
  style.textContent = STYLES(options.color);
  const launcher = el('button', { class: `launcher ${options.position}`, type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, options.label);
  const panel = el('div', { class: `panel ${options.position}`, role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'tf-title', hidden: true });
  root.append(style, launcher, panel);
  document.body.append(host);

  let screenshot: string | null = null;
  let captchaToken: string | null = null;
  let captchaId: string | null = null;

  const field = (id: string, label: string, control: HTMLElement, hint?: string) => el('label', { class: 'field', for: id }, el('span', {}, label, hint ? el('small', {}, ` ${hint}`) : null), control);

  const renderForm = () => {
    screenshot = null;
    captchaToken = null;
    const kind = el('select', { id: 'tf-kind' }, el('option', { value: 'bug' }, 'Something is broken'), el('option', { value: 'suggestion' }, 'A suggestion'), el('option', { value: 'feature_request' }, 'A feature request'));
    const title = el('input', { id: 'tf-summary', type: 'text', maxlength: String(BUG_LIMITS.title), required: true, autocomplete: 'off', placeholder: 'A short summary' });
    const actual = el('textarea', { id: 'tf-actual', maxlength: String(BUG_LIMITS.text), rows: '3', placeholder: 'What happened?' });
    const expected = el('textarea', { id: 'tf-expected', maxlength: String(BUG_LIMITS.text), rows: '2', placeholder: 'What did you expect? (optional)' });
    const name = el('input', { id: 'tf-name', type: 'text', maxlength: '80', autocomplete: 'name' });
    const email = el('input', { id: 'tf-email', type: 'email', maxlength: '200', autocomplete: 'email' });
    // People never see this; bots fill it in.
    const trap = el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', class: 'trap' });
    const details = el('input', { id: 'tf-details', type: 'checkbox', checked: Boolean(recorder) });
    const shotStatus = el('span', { class: 'muted' });
    const shotButton = el('button', { type: 'button', class: 'secondary' }, 'Add a screenshot');
    const captcha = el('div', { class: 'captcha' });
    const status = el('p', { class: 'status', role: 'status' });
    const submit = el('button', { type: 'submit', class: 'primary' }, 'Send');

    const takeShot = async () => {
      panel.hidden = true;
      try {
        screenshot = await shrink(await captureScreenshot());
        shotStatus.textContent = 'Screenshot added';
        shotButton.textContent = 'Retake';
      } catch (error) {
        if (!(error instanceof Error) || !/NotAllowed|Abort/i.test(error.name)) shotStatus.textContent = 'Couldn’t take a screenshot';
      } finally {
        panel.hidden = false;
      }
    };
    shotButton.addEventListener('click', () => void takeShot());

    const form = el(
      'form',
      { novalidate: true },
      el('h2', { id: 'tf-title' }, config.title),
      config.intro ? el('p', { class: 'muted' }, config.intro) : null,
      field('tf-kind', 'This is', kind),
      field('tf-summary', 'Summary', title),
      field('tf-actual', 'Details', actual),
      field('tf-expected', 'Expected', expected),
      el('div', { class: 'row' }, field('tf-name', 'Name', name, '(optional)'), field('tf-email', 'Email', email, '(optional, for follow-up)')),
      canCaptureScreen() ? el('div', { class: 'row shot' }, shotButton, shotStatus) : null,
      recorder ? el('label', { class: 'check', for: 'tf-details' }, details, el('span', {}, 'Include technical details (errors and failed requests from this page; passwords and tokens are removed)')) : null,
      trap,
      captcha,
      status,
      el('div', { class: 'row end' }, el('button', { type: 'button', class: 'secondary', 'data-close': true }, 'Cancel'), submit),
    );
    form.querySelector('[data-close]')!.addEventListener('click', close);

    if (config.captchaSiteKey) {
      void loadTurnstile()
        .then((turnstile) => {
          captchaId = turnstile.render(captcha, { sitekey: config.captchaSiteKey!, callback: (token) => (captchaToken = token), 'expired-callback': () => (captchaToken = null) });
        })
        .catch(() => (status.textContent = 'The CAPTCHA could not load; please try again later.'));
    }

    const send = async () => {
      if (title.value.trim().length < 3) {
        status.textContent = 'Add a short summary.';
        title.focus();
        return;
      }
      if (config.captchaSiteKey && !captchaToken) {
        status.textContent = 'Please complete the CAPTCHA.';
        return;
      }
      submit.disabled = true;
      status.textContent = 'Sending…';
      const environment = detectEnvironment();
      try {
        const response = await fetch(`${base}/reports`, {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            via: 'widget',
            kind: kind.value,
            title: title.value.trim(),
            actual: actual.value.trim() || null,
            expected: expected.value.trim() || null,
            name: name.value.trim() || null,
            email: email.value.trim() || null,
            context: { pageUrl: environment.pageUrl, browser: environment.browser, os: environment.os, viewport: environment.viewport, userAgent: environment.userAgent },
            captureJson: recorder && details.checked ? JSON.stringify(recorder.snapshot()) : null,
            screenshot,
            captchaToken,
            website: trap.value || null,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as Partial<PublicReportResponse> & { message?: string };
        if (!response.ok || !body.trackingPath) throw new Error(body.message ?? 'Your feedback couldn’t be sent. Please try again.');
        const link = el('a', { href: `${options.server}${body.trackingPath}`, target: '_blank', rel: 'noopener noreferrer' }, 'Follow its progress');
        panel.replaceChildren(
          el('h2', { id: 'tf-title' }, 'Thank you!'),
          el('p', {}, `We got your report (#${body.number}).`),
          el('p', {}, link),
          el('div', { class: 'row end' }, el('button', { type: 'button', class: 'primary', 'data-close': true }, 'Close')),
        );
        panel.querySelector('[data-close]')!.addEventListener('click', close);
        recorder?.clear();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Your feedback couldn’t be sent.';
        submit.disabled = false;
        if (captchaId) void loadTurnstile().then((turnstile) => turnstile.reset(captchaId!));
        captchaToken = null;
      }
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void send();
    });
    panel.replaceChildren(form);
  };

  function open(): void {
    if (!panel.hidden) return;
    renderForm();
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    (panel.querySelector('#tf-summary') as HTMLInputElement | null)?.focus();
  }

  function close(): void {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  launcher.addEventListener('click', () => (panel.hidden ? open() : close()));
  root.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape' && !panel.hidden) close();
  });
  (window as unknown as { TaskFlowFeedback: { open(): void; close(): void } }).TaskFlowFeedback = { open, close };
}

const options = readOptions();
if (options && !(window as unknown as { TaskFlowFeedback?: unknown }).TaskFlowFeedback) {
  const go = () => void start(options);
  if (document.body) go();
  else document.addEventListener('DOMContentLoaded', go, { once: true });
}

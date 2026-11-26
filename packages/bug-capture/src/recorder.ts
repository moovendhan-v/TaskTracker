import {
  BUG_LIMITS,
  CONSOLE_LEVELS,
  isFailedRequest,
  isSensitiveField,
  REDACTED,
  redactBody,
  redactHeaders,
  redactJson,
  redactText,
  redactUrl,
  type ActionEntry,
  type BugCaptureInput,
  type ConsoleEntry,
  type ConsoleLevel,
  type NetworkEntry,
} from '@taskflow/shared-types';
import { cssSelector, describeElement } from './element.js';

export interface RecorderOptions {
  /** Keep request and response bodies: only for failed requests (default), always, or never. */
  bodies?: 'failed' | 'all' | 'none';
  /** Requests whose URL matches are not recorded (the reporter's own calls, analytics…). */
  ignoreUrls?: readonly RegExp[];
  /** Elements inside a node with this attribute are not recorded (the report dialog itself). */
  ignoreAttribute?: string;
}

const IGNORE_ATTRIBUTE = 'data-bug-capture-ignore';

/**
 * Records what happened on the page while it runs: console output and uncaught errors, fetch and
 * XHR calls, and clicks, typing, form submits, keys and navigation. Everything is redacted as it
 * is recorded (and again on the server); values typed into secret-looking fields are never kept.
 * Ring buffers keep the latest entries only, so it can run for the whole session.
 */
export class CaptureRecorder {
  private readonly console: ConsoleEntry[] = [];
  private readonly network: NetworkEntry[] = [];
  private readonly actions: ActionEntry[] = [];
  private readonly undo: (() => void)[] = [];
  private readonly startedAt = Date.now();
  private readonly options: Required<RecorderOptions>;
  private running = false;

  constructor(options: RecorderOptions = {}) {
    this.options = { bodies: options.bodies ?? 'failed', ignoreUrls: options.ignoreUrls ?? [], ignoreAttribute: options.ignoreAttribute ?? IGNORE_ATTRIBUTE };
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): this {
    if (this.running || typeof window === 'undefined') return this;
    this.running = true;
    this.patchConsole();
    this.listenForErrors();
    this.patchFetch();
    this.patchXhr();
    this.listenForActions();
    this.patchHistory();
    this.pushAction({ type: 'navigate', url: location.href });
    return this;
  }

  /** Puts back everything start() replaced. */
  stop(): void {
    while (this.undo.length) this.undo.pop()!();
    this.running = false;
  }

  clear(): void {
    this.console.length = 0;
    this.network.length = 0;
    this.actions.length = 0;
  }

  /** A copy of what was recorded, trimmed so it fits one report. */
  snapshot(): Required<{ [K in keyof BugCaptureInput]: NonNullable<BugCaptureInput[K]> }> {
    const capture = { console: this.console.map((entry) => ({ ...entry })), network: this.network.map((entry) => ({ ...entry })), actions: this.actions.map((entry) => ({ ...entry })) };
    // Over budget: drop bodies first, then the oldest entries.
    let size = JSON.stringify(capture).length;
    for (const entry of capture.network) {
      if (size <= BUG_LIMITS.captureJson) break;
      size -= (entry.requestBody?.length ?? 0) + (entry.responseBody?.length ?? 0);
      entry.requestBody = null;
      entry.responseBody = null;
    }
    while (JSON.stringify(capture).length > BUG_LIMITS.captureJson && (capture.network.length || capture.console.length || capture.actions.length)) {
      if (capture.network.length >= capture.console.length) capture.network.shift();
      else capture.console.shift();
      if (capture.actions.length > 50) capture.actions.shift();
    }
    return capture;
  }

  private now(): number {
    return Date.now() - this.startedAt;
  }

  private ignoredUrl(url: string): boolean {
    return this.options.ignoreUrls.some((pattern) => pattern.test(url));
  }

  private push<T>(buffer: T[], entry: T, limit: number): void {
    buffer.push(entry);
    if (buffer.length > limit) buffer.splice(0, buffer.length - limit);
  }

  private pushConsole(level: ConsoleLevel, message: string, stack?: string | null, uncaught = false): void {
    this.push(this.console, { level, message: redactText(message).slice(0, BUG_LIMITS.message), at: this.now(), stack: stack ? redactText(stack).slice(0, BUG_LIMITS.message) : null, uncaught }, BUG_LIMITS.console);
  }

  private pushAction(action: Omit<ActionEntry, 'at'>): void {
    this.push(this.actions, { ...action, at: this.now(), url: action.url ? redactUrl(action.url) : null }, BUG_LIMITS.actions);
  }

  private patchConsole(): void {
    const target = console as unknown as Record<ConsoleLevel, (...args: unknown[]) => void>;
    for (const level of CONSOLE_LEVELS as readonly ConsoleLevel[]) {
      const original = target[level];
      target[level] = (...args: unknown[]) => {
        try {
          const error = args.find((arg): arg is Error => arg instanceof Error);
          this.pushConsole(level, args.map(formatArg).join(' '), error?.stack ?? null);
        } catch {
          // Never break the page's own logging.
        }
        original.apply(console, args);
      };
      this.undo.push(() => {
        target[level] = original;
      });
    }
  }

  private listenForErrors(): void {
    const onError = (event: ErrorEvent) => {
      const where = event.filename ? ` (${redactUrl(event.filename)}:${event.lineno}:${event.colno})` : '';
      this.pushConsole('error', `${event.message || 'Uncaught error'}${where}`, (event.error as Error | undefined)?.stack ?? null, true);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      this.pushConsole('error', `Unhandled rejection: ${formatArg(reason)}`, reason instanceof Error ? reason.stack ?? null : null, true);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    this.undo.push(() => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    });
  }

  /** The helpers patched browser functions call (they run with the browser's `this`). */
  private bound() {
    return {
      now: () => this.now(),
      ignoredUrl: (url: string) => this.ignoredUrl(url),
      keepBody: (status: number, error: string | null) => this.keepBody(status, error),
      recordRequest: (entry: NetworkEntry) => this.recordRequest(entry),
      bodies: this.options.bodies,
    };
  }

  private keepBody(status: number, error: string | null): boolean {
    return this.options.bodies === 'all' || (this.options.bodies === 'failed' && isFailedRequest({ status, error }));
  }

  private recordRequest(entry: NetworkEntry): void {
    this.push(this.network, entry, BUG_LIMITS.network);
  }

  private patchFetch(): void {
    const original = window.fetch;
    if (!original) return;
    const recorder = this.bound();
    window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input instanceof URL ? input.href : input);
      if (recorder.ignoredUrl(url)) return original.call(window, input, init);
      const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
      const started = performance.now();
      const at = recorder.now();
      const requestHeaders = headersToObject(init?.headers ?? request?.headers);
      const requestBody = typeof init?.body === 'string' ? init.body : null;
      try {
        const response = await original.call(window, input, init);
        const entry: NetworkEntry = {
          method,
          url: redactUrl(url),
          status: response.status,
          durationMs: Math.round(performance.now() - started),
          at,
          requestHeaders: redactHeaders(requestHeaders),
          responseHeaders: redactHeaders(pickHeaders(response.headers)),
          requestBody: null,
          responseBody: null,
          error: null,
        };
        // GraphQL reports errors with a 200: look inside short JSON answers for them.
        const graphqlError = await graphqlErrorsOf(response);
        if (graphqlError) entry.error = graphqlError;
        if (recorder.keepBody(entry.status, entry.error ?? null)) {
          entry.requestBody = redactBody(requestBody, BUG_LIMITS.body);
          entry.responseBody = redactBody(await readText(response), BUG_LIMITS.body);
        }
        recorder.recordRequest(entry);
        return response;
      } catch (error) {
        recorder.recordRequest({
          method,
          url: redactUrl(url),
          status: 0,
          durationMs: Math.round(performance.now() - started),
          at,
          requestHeaders: redactHeaders(requestHeaders),
          requestBody: recorder.bodies === 'none' ? null : redactBody(requestBody, BUG_LIMITS.body),
          responseBody: null,
          error: redactText(error instanceof Error ? error.message : String(error)).slice(0, 300),
        });
        throw error;
      }
    };
    this.undo.push(() => {
      window.fetch = original;
    });
  }

  private patchXhr(): void {
    if (typeof XMLHttpRequest === 'undefined') return;
    const proto = XMLHttpRequest.prototype;
    const { open, send, setRequestHeader } = proto;
    const recorder = this.bound();
    type Tracked = XMLHttpRequest & { __bug?: { method: string; url: string; headers: Record<string, string> } };
    proto.open = function (this: Tracked, method: string, url: string | URL, ...rest: unknown[]) {
      this.__bug = { method: method.toUpperCase(), url: String(url), headers: {} };
      return (open as (...args: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof proto.open;
    proto.setRequestHeader = function (this: Tracked, name: string, value: string) {
      if (this.__bug) this.__bug.headers[name] = value;
      return setRequestHeader.call(this, name, value);
    };
    proto.send = function (this: Tracked, body?: Document | XMLHttpRequestBodyInit | null) {
      const info = this.__bug;
      if (info && !recorder.ignoredUrl(info.url)) {
        const started = performance.now();
        const at = recorder.now();
        this.addEventListener('loadend', () => {
          const status = this.status;
          const error = status === 0 ? 'No response' : null;
          const keep = recorder.keepBody(status, error);
          recorder.recordRequest({
            method: info.method,
            url: redactUrl(new URL(info.url, location.href).href),
            status,
            durationMs: Math.round(performance.now() - started),
            at,
            requestHeaders: redactHeaders(info.headers),
            requestBody: keep && typeof body === 'string' ? redactBody(body, BUG_LIMITS.body) : null,
            responseBody: keep && (this.responseType === '' || this.responseType === 'text') ? redactBody(this.responseText, BUG_LIMITS.body) : null,
            error,
          });
        });
      }
      return send.call(this, body);
    };
    this.undo.push(() => {
      proto.open = open;
      proto.send = send;
      proto.setRequestHeader = setRequestHeader;
    });
  }

  private ignored(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) return null;
    return target.closest(`[${this.options.ignoreAttribute}]`) ? null : target;
  }

  private listenForActions(): void {
    const onClick = (event: MouseEvent) => {
      const element = this.ignored(event.target);
      if (!element) return;
      const target = element.closest('button, a, [role="button"], [role="menuitem"], [role="tab"], [role="option"], label, input, select, summary') ?? element;
      if (target instanceof HTMLInputElement && ['text', 'email', 'search', 'password', 'number', 'url', 'tel'].includes(target.type)) return;
      this.pushAction({ type: 'click', target: describeElement(target), selector: cssSelector(target) });
    };
    const onChange = (event: Event) => {
      const element = this.ignored(event.target);
      if (!element) return;
      if (element instanceof HTMLSelectElement) {
        this.pushAction({ type: 'select', target: describeElement(element), selector: cssSelector(element), value: element.selectedOptions[0]?.text.slice(0, 200) ?? null });
      } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
          this.pushAction({ type: 'click', target: describeElement(element), selector: cssSelector(element) });
          return;
        }
        const secret = isSensitiveField({ type: element instanceof HTMLInputElement ? element.type : 'textarea', name: element.name, id: element.id, autocomplete: element.autocomplete });
        this.pushAction({ type: 'input', target: describeElement(element), selector: cssSelector(element), value: secret || element instanceof HTMLInputElement && element.type === 'file' ? REDACTED : redactText(element.value.slice(0, 200)) });
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      const element = this.ignored(event.target);
      if (element) this.pushAction({ type: 'submit', target: describeElement(element), selector: cssSelector(element) });
    };
    const onKey = (event: KeyboardEvent) => {
      if (!['Enter', 'Escape'].includes(event.key) || !this.ignored(event.target)) return;
      this.pushAction({ type: 'key', value: event.key, target: event.target instanceof Element ? describeElement(event.target) : null });
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('keydown', onKey, true);
    this.undo.push(() => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('keydown', onKey, true);
    });
  }

  private patchHistory(): void {
    const { pushState, replaceState } = history;
    let last = location.href;
    const changed = () => {
      if (location.href === last) return;
      last = location.href;
      this.pushAction({ type: 'navigate', url: location.href });
    };
    history.pushState = function (...args: Parameters<History['pushState']>) {
      pushState.apply(history, args);
      changed();
    };
    history.replaceState = function (...args: Parameters<History['replaceState']>) {
      replaceState.apply(history, args);
      changed();
    };
    window.addEventListener('popstate', changed);
    this.undo.push(() => {
      history.pushState = pushState;
      history.replaceState = replaceState;
      window.removeEventListener('popstate', changed);
    });
  }
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'function') return `[function ${arg.name || 'anonymous'}]`;
  if (typeof Element !== 'undefined' && arg instanceof Element) return `<${arg.tagName.toLowerCase()}>`;
  try {
    return JSON.stringify(redactJson(arg))?.slice(0, BUG_LIMITS.message) ?? String(arg);
  } catch {
    return String(arg);
  }
}

function headersToObject(headers: HeadersInit | Headers | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...(headers as Record<string, string>) };
}

const KEPT_RESPONSE_HEADERS = ['content-type', 'content-length', 'cache-control', 'x-request-id', 'retry-after'];

function pickHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(KEPT_RESPONSE_HEADERS.flatMap((name) => (headers.has(name) ? [[name, headers.get(name)!]] : [])));
}

const TEXTUAL = /json|text|xml|graphql|javascript|x-www-form-urlencoded/i;

async function readText(response: Response): Promise<string | null> {
  if (!TEXTUAL.test(response.headers.get('content-type') ?? '')) return null;
  try {
    return (await response.clone().text()).slice(0, BUG_LIMITS.body * 4);
  } catch {
    return null;
  }
}

async function graphqlErrorsOf(response: Response): Promise<string | null> {
  if (!/json/i.test(response.headers.get('content-type') ?? '') || Number(response.headers.get('content-length') ?? 0) > 200_000) return null;
  const text = await readText(response);
  if (!text || !text.includes('"errors"')) return null;
  try {
    const body = JSON.parse(text) as { errors?: { message?: string }[] };
    const first = body.errors?.[0]?.message;
    return first ? redactText(`GraphQL: ${first}`).slice(0, 300) : null;
  } catch {
    return null;
  }
}

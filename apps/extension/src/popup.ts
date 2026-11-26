import type { ExtensionSessionResponse } from '@taskflow/shared-types';
import { api, NotConnectedError } from './api.js';
import type { BackgroundMessage } from './background.js';
import { ext, type Tab } from './browser.js';
import { getConnection, getPending, lastServer, normalizeServer } from './config.js';
import { h, render } from './dom.js';

const app = document.getElementById('app')!;
const ALL_SITES = ['http://*/*', 'https://*/*'];

async function send(message: BackgroundMessage): Promise<{ ok: boolean; error?: string; status?: string }> {
  return ext.runtime.sendMessage(message);
}

async function activeTab(): Promise<Tab | null> {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

const capturable = (tab: Tab | null) => Boolean(tab?.id !== undefined && tab.url && /^https?:/.test(tab.url));

function message(text: string, tone: 'error' | 'muted' | 'ok' = 'muted') {
  return h('p', { class: `small ${tone}`, role: tone === 'error' ? 'alert' : undefined }, text);
}

async function showConnect(error?: string): Promise<void> {
  const pending = await getPending();
  if (pending) return showWaiting(pending.server);
  const server = h('input', { type: 'url', id: 'server', placeholder: 'https://taskflow.example.com', value: await lastServer(), autocomplete: 'url' });
  const connect = async (event: Event) => {
    event.preventDefault();
    const origin = normalizeServer(server.value);
    if (!origin) return showConnect('Enter your TaskFlow address, starting with https://');
    // Asked here (a click) because browsers only allow permission prompts from a user gesture.
    if (!(await ext.permissions.request({ origins: [`${origin}/*`] }))) return showConnect('The extension needs permission to talk to your TaskFlow.');
    const result = await send({ type: 'connect', server: origin });
    if (!result.ok) return showConnect(result.error ?? 'Could not start connecting');
    await showWaiting(origin);
  };
  render(
    app,
    h('h1', {}, 'TaskFlow bug reporter'),
    h('p', { class: 'muted small' }, 'Report bugs from any page with a screenshot, a recording and the page’s console and network. Connect it to your TaskFlow first.'),
    h('form', { class: 'stack', onsubmit: connect }, h('label', { class: 'field', for: 'server' }, 'TaskFlow address', server), h('button', { class: 'primary', type: 'submit' }, 'Connect')),
    error ? message(error, 'error') : null,
  );
  server.focus();
}

async function showWaiting(server: string): Promise<void> {
  render(
    app,
    h('h1', {}, 'Allow it in TaskFlow'),
    h('p', { class: 'small' }, `A TaskFlow tab opened at ${new URL(server).host}. Sign in if asked, pick the workspace and press Allow. This finishes on its own.`),
    h('p', { class: 'row small muted' }, h('span', { class: 'dot live' }), 'Waiting…'),
    h('button', { class: 'link small', onclick: async () => {
      await ext.storage.local.remove('pendingConnection');
      await showConnect();
    } }, 'Start over'),
  );
  const poll = async () => {
    const result = await send({ type: 'finishConnect' });
    if (result.status === 'connected') return showConnected();
    if (result.status === 'none') return showConnect('The connection wasn’t allowed in time. Try again.');
    window.setTimeout(() => void poll(), 2000);
  };
  void poll();
}

async function isCapturing(tab: Tab | null): Promise<boolean> {
  if (!capturable(tab)) return false;
  try {
    const [result] = await ext.scripting.executeScript({ target: { tabId: tab!.id! }, world: 'MAIN', func: () => Boolean((window as unknown as { __taskflowCapture?: unknown }).__taskflowCapture) });
    return result?.result === true;
  } catch {
    return false;
  }
}

async function showConnected(): Promise<void> {
  const connection = await getConnection();
  if (!connection) return showConnect();
  render(app, h('p', { class: 'muted small' }, 'Loading…'));
  let session: ExtensionSessionResponse;
  try {
    session = await api.session();
  } catch (error) {
    if (error instanceof NotConnectedError) return showConnect('This connection was disconnected or expired. Connect again.');
    render(app, h('h1', {}, 'TaskFlow'), message(error instanceof Error ? error.message : 'TaskFlow can’t be reached', 'error'), h('button', { onclick: () => void showConnected() }, 'Try again'));
    return;
  }
  const tab = await activeTab();
  const canCapture = capturable(tab);
  const capturing = await isCapturing(tab);
  const always = await ext.permissions.contains({ origins: ALL_SITES });

  const start = (pick: boolean) => async () => {
    if (!tab?.id) return;
    const result = await send({ type: 'report', tabId: tab.id, windowId: tab.windowId, pick });
    if (!result.ok) render(app, message(result.error ?? 'Could not capture this page', 'error'));
    else window.close();
  };
  const startCapture = async () => {
    if (!tab?.id) return;
    const result = await send({ type: 'startCapture', tabId: tab.id });
    if (result.ok) await showConnected();
    else render(app, message(result.error ?? 'Could not start capturing', 'error'));
  };
  const toggleAlways = async (event: Event) => {
    const on = (event.target as HTMLInputElement).checked;
    if (on && !(await ext.permissions.request({ origins: ALL_SITES }))) return showConnected();
    await send({ type: 'setAlwaysCapture', on });
    if (!on) await ext.permissions.remove({ origins: ALL_SITES });
    await showConnected();
  };

  render(
    app,
    h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h1', {}, session.workspace.name), h('p', { class: 'muted small' }, `${session.user.name} · ${new URL(connection.server).host}`))),
    canCapture
      ? h(
          'div',
          { class: 'stack' },
          h('button', { class: 'primary block', onclick: start(false) }, '📸  Report a bug on this page'),
          h('button', { class: 'block', onclick: start(true) }, '🎯  Point at the broken element, then report'),
          capturing
            ? h('p', { class: 'row small' }, h('span', { class: 'dot live' }), 'Capturing console, network and clicks on this tab')
            : h('button', { class: 'block', onclick: startCapture }, '⏺  Capture console & network on this tab'),
          capturing ? null : h('p', { class: 'muted small' }, 'Start capturing, reproduce the bug, then report: the steps, errors and failed requests are attached.'),
        )
      : message('Open a web page (http or https) to report a bug on it. Browser pages like settings or the new tab page can’t be captured.'),
    h(
      'label',
      { class: 'row small' },
      h('input', { type: 'checkbox', checked: always, onchange: toggleAlways }),
      h('span', { class: 'grow' }, 'Capture on every site automatically ', h('span', { class: 'muted' }, '(asks for access to all sites; recorded in memory only, sent only with a report)')),
    ),
    h(
      'div',
      { class: 'row small' },
      h('button', { class: 'link', onclick: () => void ext.tabs.create({ url: connection.server }) }, 'Open TaskFlow'),
      h('span', { class: 'grow' }),
      h('button', { class: 'link', onclick: async () => {
        await api.disconnect();
        await showConnect();
      } }, 'Disconnect'),
    ),
  );
}

void (async () => {
  if (await getConnection()) return showConnected();
  // Allowed in TaskFlow while the popup was closed: finish now.
  if ((await getPending()) && (await send({ type: 'finishConnect' })).status === 'connected') return showConnected();
  return showConnect();
})();

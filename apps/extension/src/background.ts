import type { BugCaptureInput } from '@taskflow/shared-types';
import { browserName, ext } from './browser.js';
import { clearPending, getPending, normalizeServer, PENDING_TTL_MS, saveConnection, savePending } from './config.js';
import { api } from './api.js';
import { challengeFor, createVerifier } from './pkce.js';
import type { Draft, PickedElement } from './draft.js';

const FINISH_ALARM = 'finish-connect';
const ALWAYS_ID = 'taskflow-always-capture';

export type BackgroundMessage =
  | { type: 'connect'; server: string }
  | { type: 'finishConnect' }
  | { type: 'startCapture'; tabId: number }
  | { type: 'report'; tabId: number; windowId: number; pick: boolean }
  | { type: 'setAlwaysCapture'; on: boolean };

/** Swaps the verifier for the token once the person allowed the connection in TaskFlow. */
async function finishConnect(): Promise<'connected' | 'pending' | 'none'> {
  const pending = await getPending();
  if (!pending) {
    await ext.alarms.clear(FINISH_ALARM);
    return 'none';
  }
  const result = await api.exchange(pending.server, pending.verifier).catch(() => ({ status: 'pending' as const }));
  if (result.status !== 'connected') {
    if (Date.now() - pending.startedAt > PENDING_TTL_MS) await clearPending();
    return 'pending';
  }
  await saveConnection({ server: pending.server, token: result.token, expiresAt: result.expiresAt });
  await clearPending();
  await ext.alarms.clear(FINISH_ALARM);
  return 'connected';
}

async function connect(input: string): Promise<void> {
  const server = normalizeServer(input);
  if (!server) throw new Error('Enter your TaskFlow address, starting with https://');
  const verifier = createVerifier();
  await savePending({ server, verifier, startedAt: Date.now() });
  const name = `TaskFlow extension (${browserName()})`;
  await ext.tabs.create({ url: `${server}/extension/connect?challenge=${await challengeFor(verifier)}&name=${encodeURIComponent(name)}` });
  // The approval happens in that tab; check now and then until it does (the popup also checks while open).
  await ext.alarms.create(FINISH_ALARM, { periodInMinutes: 0.5 });
}

async function startCapture(tabId: number): Promise<void> {
  await ext.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['inject/recorder.js'] });
  await ext.action.setBadgeBackgroundColor({ color: '#e5484d', tabId });
  await ext.action.setBadgeText({ text: 'REC', tabId });
}

/** Always-on capture: the recorder starts with every page, before its own scripts. Needs access to all sites, asked for in the popup. */
async function setAlwaysCapture(on: boolean): Promise<void> {
  const registered = await ext.scripting.getRegisteredContentScripts({ ids: [ALWAYS_ID] });
  if (registered.length) await ext.scripting.unregisterContentScripts({ ids: [ALWAYS_ID] });
  if (on) await ext.scripting.registerContentScripts([{ id: ALWAYS_ID, matches: ['http://*/*', 'https://*/*'], js: ['inject/recorder.js'], runAt: 'document_start', world: 'MAIN', persistAcrossSessions: true }]);
}

async function pick(tabId: number): Promise<PickedElement | null> {
  await ext.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['inject/picker.js'] });
  const [result] = await ext.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => (window as unknown as { __taskflowPick?: Promise<PickedElement | null> }).__taskflowPick ?? Promise.resolve(null),
  });
  return result?.result ?? null;
}

/** Screenshot, page details and whatever was captured, saved as a draft; the report page opens on it. */
async function report(tabId: number, windowId: number, withPick: boolean): Promise<void> {
  const element = withPick ? await pick(tabId) : null;
  // After picking, let the highlight go before the screenshot.
  if (withPick) await new Promise((resolve) => setTimeout(resolve, 150));
  const screenshot = await ext.tabs.captureVisibleTab(windowId, { format: 'png' });
  const [page] = await ext.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => ({
        url: location.href,
        title: document.title,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio,
        userAgent: navigator.userAgent,
        capture: (window as unknown as { __taskflowCapture?: { snapshot(): unknown } }).__taskflowCapture?.snapshot() ?? null,
      }),
    })
    .catch(() => [undefined]);
  const info = page?.result;
  const draft: Draft = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    screenshot,
    pageUrl: info?.url ?? null,
    pageTitle: info?.title ?? null,
    viewport: info?.viewport ?? null,
    devicePixelRatio: info?.devicePixelRatio ?? 1,
    userAgent: info?.userAgent ?? navigator.userAgent,
    capture: (info?.capture as BugCaptureInput | null) ?? null,
    element,
  };
  await ext.storage.session.set({ [`draft:${draft.id}`]: draft });
  await ext.tabs.create({ url: ext.runtime.getURL(`report.html?draft=${draft.id}`) });
}

ext.runtime.onMessage.addListener((message, _sender, respond) => {
  const run = async () => {
    const typed = message as BackgroundMessage;
    switch (typed.type) {
      case 'connect':
        await connect(typed.server);
        return { ok: true };
      case 'finishConnect':
        return { ok: true, status: await finishConnect() };
      case 'startCapture':
        await startCapture(typed.tabId);
        return { ok: true };
      case 'report':
        await report(typed.tabId, typed.windowId, typed.pick);
        return { ok: true };
      case 'setAlwaysCapture':
        await setAlwaysCapture(typed.on);
        return { ok: true };
    }
  };
  run().then(respond, (error: unknown) => respond({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FINISH_ALARM) void finishConnect();
});

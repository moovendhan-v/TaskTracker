/**
 * The slice of the WebExtension API this extension uses. Chrome and Firefox (Manifest V3) both
 * expose it as `chrome.*` with promises, so one typed handle covers both browsers.
 */
export interface Tab {
  id?: number;
  windowId: number;
  url?: string;
  title?: string;
  active?: boolean;
}

interface StorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

interface InjectionResult<T> {
  result?: T;
}

export interface ExtensionApi {
  runtime: {
    getURL(path: string): string;
    sendMessage<T>(message: unknown): Promise<T>;
    onMessage: { addListener(listener: (message: unknown, sender: unknown, respond: (response: unknown) => void) => boolean | void): void };
    onInstalled: { addListener(listener: () => void): void };
    getManifest(): { version: string; name: string };
  };
  storage: { local: StorageArea; session: StorageArea };
  tabs: {
    query(query: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
    create(properties: { url: string; active?: boolean }): Promise<Tab>;
    captureVisibleTab(windowId: number, options: { format: 'png' | 'jpeg'; quality?: number }): Promise<string>;
    onRemoved: { addListener(listener: (tabId: number) => void): void };
  };
  scripting: {
    executeScript<T>(injection: { target: { tabId: number }; world?: 'MAIN' | 'ISOLATED'; files?: string[]; func?: (...args: never[]) => T | Promise<T>; args?: unknown[] }): Promise<InjectionResult<Awaited<T>>[]>;
    registerContentScripts(scripts: { id: string; matches: string[]; js: string[]; runAt: 'document_start'; world: 'MAIN'; allFrames?: boolean; persistAcrossSessions?: boolean }[]): Promise<void>;
    unregisterContentScripts(filter?: { ids: string[] }): Promise<void>;
    getRegisteredContentScripts(filter?: { ids: string[] }): Promise<{ id: string }[]>;
  };
  permissions: {
    request(permissions: { origins: string[] }): Promise<boolean>;
    contains(permissions: { origins: string[] }): Promise<boolean>;
    remove(permissions: { origins: string[] }): Promise<boolean>;
  };
  alarms: {
    create(name: string, info: { periodInMinutes: number }): Promise<void> | void;
    clear(name: string): Promise<boolean>;
    onAlarm: { addListener(listener: (alarm: { name: string }) => void): void };
  };
  action: {
    setBadgeText(details: { text: string; tabId?: number }): Promise<void>;
    setBadgeBackgroundColor(details: { color: string; tabId?: number }): Promise<void>;
  };
}

export const ext = (globalThis as unknown as { chrome: ExtensionApi }).chrome;

/** Which browser we're in, for the connection's name ("TaskFlow extension (Firefox)"). */
export function browserName(): string {
  return /Firefox\//.test(navigator.userAgent) ? 'Firefox' : /Edg\//.test(navigator.userAgent) ? 'Edge' : 'Chrome';
}

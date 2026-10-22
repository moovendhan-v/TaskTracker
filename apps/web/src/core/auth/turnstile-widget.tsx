import { useEffect, useRef } from 'react';
import { env } from '@/core/config/env';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the CAPTCHA'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileWidgetProps {
  action: string;
  onToken: (token: string | null) => void;
}

/** Renders nothing when no site key is configured (CAPTCHA off for local development). */
export function TurnstileWidget({ action, onToken }: TurnstileWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const siteKey = env.turnstileSiteKey;
    if (!siteKey || !container.current) return;
    let widgetId: string | null = null;
    let cancelled = false;

    void loadScript().then(() => {
      if (cancelled || !container.current || !window.turnstile) return;
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        action,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      });
    });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, onToken]);

  return env.turnstileSiteKey ? <div ref={container} className="min-h-[65px]" /> : null;
}

/** True when the form can submit: either the CAPTCHA is off or a token is present. */
export function captchaSatisfied(token: string | null): boolean {
  return !env.turnstileSiteKey || Boolean(token);
}

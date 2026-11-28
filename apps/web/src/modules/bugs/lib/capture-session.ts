import { CaptureRecorder } from '@taskflow/bug-capture';

/**
 * The app records its own console, errors, requests and clicks from the moment it loads, so a bug
 * report filed later carries what led up to it. Redacted as it records; kept in memory only, never
 * sent anywhere until the reporter files a report with diagnostics switched on.
 */
export const appRecorder = new CaptureRecorder({ bodies: 'failed' });

export function startAppRecorder(): void {
  if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') appRecorder.start();
}

import { CaptureRecorder } from '@taskflow/bug-capture';

/**
 * Runs in the page (MAIN world) once the reporter starts capturing on a tab: records console,
 * errors, requests and clicks, redacted, in memory. The extension reads a snapshot when a report
 * is filed; nothing is sent anywhere by this script.
 */
const holder = window as unknown as { __taskflowCapture?: CaptureRecorder };
if (!holder.__taskflowCapture) holder.__taskflowCapture = new CaptureRecorder({ bodies: 'failed' }).start();

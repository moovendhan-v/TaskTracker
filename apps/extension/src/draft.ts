import type { BugCaptureInput } from '@taskflow/shared-types';

export interface PickedElement {
  selector: string;
  description: string;
  rect: { x: number; y: number; width: number; height: number };
}

/** What the background captured for one report, kept in session storage until it's filed. */
export interface Draft {
  id: string;
  createdAt: number;
  /** PNG data URL of the visible tab. */
  screenshot: string;
  pageUrl: string | null;
  pageTitle: string | null;
  viewport: string | null;
  devicePixelRatio: number;
  userAgent: string;
  capture: BugCaptureInput | null;
  element: PickedElement | null;
}

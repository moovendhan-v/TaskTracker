/** Build-time settings. Only VITE_* values reach the browser, so nothing secret belongs here. */
export const env = {
  turnstileSiteKey: (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || null,
} as const;

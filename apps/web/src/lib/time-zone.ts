/** The viewer's IANA time zone, for exports and schedules; UTC when the browser won't say. */
export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Time zones the browser knows, for pickers (just the viewer's own when it can't list them). */
export function knownTimeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [viewerTimeZone()];
  } catch {
    return [viewerTimeZone()];
  }
}

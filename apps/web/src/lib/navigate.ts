/** In-app navigation for code outside components (e.g. a toast's button). The app registers it at start. */
let go: ((href: string) => void) | null = null;

export function setAppNavigate(navigate: (href: string) => void): void {
  go = navigate;
}

/** Navigates within the app; a full page load if the app hasn't registered its router (tests, early errors). */
export function navigateTo(href: string): void {
  if (go) go(href);
  else window.location.assign(href);
}

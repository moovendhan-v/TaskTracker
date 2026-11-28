import { redactUrl, type BugEnvironmentInfo } from '@taskflow/shared-types';

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Edge'],
  [/OPR\/([\d.]+)/, 'Opera'],
  [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
  [/Firefox\/([\d.]+)/, 'Firefox'],
  [/FxiOS\/([\d.]+)/, 'Firefox'],
  [/CriOS\/([\d.]+)/, 'Chrome'],
  [/Chrome\/([\d.]+)/, 'Chrome'],
  [/Version\/([\d.]+).*Safari/, 'Safari'],
];

const SYSTEMS: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/Windows NT 10\.0/, () => 'Windows 10/11'],
  [/Windows NT ([\d.]+)/, (m) => `Windows NT ${m[1]}`],
  [/(?:iPhone|iPad|iPod).*OS ([\d_]+)/, (m) => `iOS ${m[1]!.replace(/_/g, '.')}`],
  [/Mac OS X ([\d_.]+)/, (m) => `macOS ${m[1]!.replace(/_/g, '.')}`],
  [/Android ([\d.]+)/, (m) => `Android ${m[1]}`],
  [/CrOS/, () => 'ChromeOS'],
  [/Linux/, () => 'Linux'],
];

/** Browser and OS from a user agent string: "Chrome 132", "macOS 10.15.7". */
export function parseUserAgent(userAgent: string): { browser: string | null; os: string | null } {
  let browser: string | null = null;
  for (const [pattern, name] of BROWSERS) {
    const match = userAgent.match(pattern);
    if (match) {
      browser = `${name} ${match[1]!.split('.')[0]}`;
      break;
    }
  }
  let os: string | null = null;
  for (const [pattern, format] of SYSTEMS) {
    const match = userAgent.match(pattern);
    if (match) {
      os = format(match);
      break;
    }
  }
  return { browser, os };
}

/** Where the report was filed from: page (redacted), browser, OS, viewport. */
export function detectEnvironment(): BugEnvironmentInfo {
  const userAgent = navigator.userAgent;
  const { browser, os } = parseUserAgent(userAgent);
  return {
    pageUrl: redactUrl(location.href),
    browser,
    os,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    userAgent: userAgent.slice(0, 500),
  };
}

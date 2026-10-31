import { DEFAULT_PREFERENCES, type Accent, type Density, type Font, type Radius, type Theme } from '@taskflow/shared-types';
import type { Appearance } from '@/core/preferences/appearance';

export const THEME_OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** The v2 five first, then the older palettes people may already use. Swatches are the bright shade. */
export const ACCENT_OPTIONS: readonly { value: Accent; label: string; swatch: string }[] = [
  { value: 'orange', label: 'Orange', swatch: '#f97316' },
  { value: 'blue', label: 'Blue', swatch: '#3b82f6' },
  { value: 'green', label: 'Emerald', swatch: '#10b981' },
  { value: 'rose', label: 'Rose', swatch: '#f43f5e' },
  { value: 'slate', label: 'Zinc', swatch: '#a1a1aa' },
  { value: 'violet', label: 'Violet', swatch: '#8b5cf6' },
  { value: 'teal', label: 'Teal', swatch: '#14b8a6' },
  { value: 'amber', label: 'Amber', swatch: '#f59e0b' },
];

export const RADIUS_OPTIONS: readonly { value: Radius; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];

export const DENSITY_OPTIONS: readonly { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'comfortable', label: 'Comfortable' },
];

export const SIDEBAR_OPTIONS: readonly { value: 'panel' | 'rail'; label: string }[] = [
  { value: 'panel', label: 'Rail + panel' },
  { value: 'rail', label: 'Rail only' },
];

/** `family` matches the faces loaded in main.tsx, so each option previews in its own font. */
export const FONT_OPTIONS: readonly { value: Font; label: string; family: string }[] = [
  { value: 'geist', label: 'Geist', family: "'Geist Variable', sans-serif" },
  { value: 'inter', label: 'Inter', family: "'Inter Variable', sans-serif" },
  { value: 'plex', label: 'IBM Plex Sans', family: "'IBM Plex Sans Variable', sans-serif" },
];

export const DEFAULT_APPEARANCE: Appearance = {
  theme: DEFAULT_PREFERENCES.theme,
  accent: DEFAULT_PREFERENCES.accent,
  density: DEFAULT_PREFERENCES.density,
  radius: DEFAULT_PREFERENCES.radius,
  font: DEFAULT_PREFERENCES.font,
};

export function isDefaultAppearance(appearance: Appearance): boolean {
  return (Object.keys(DEFAULT_APPEARANCE) as (keyof Appearance)[]).every((key) => appearance[key] === DEFAULT_APPEARANCE[key]);
}

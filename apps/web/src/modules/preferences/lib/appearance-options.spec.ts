import { ACCENTS, DENSITIES, FONTS, RADII, THEMES } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';
import { ACCENT_OPTIONS, DEFAULT_APPEARANCE, DENSITY_OPTIONS, FONT_OPTIONS, isDefaultAppearance, RADIUS_OPTIONS, THEME_OPTIONS } from './appearance-options';

const values = (options: readonly { value: string }[]) => options.map((option) => option.value).sort();

describe('appearance options', () => {
  it('offers every value the API accepts, and nothing else', () => {
    expect(values(THEME_OPTIONS)).toEqual([...THEMES].sort());
    expect(values(ACCENT_OPTIONS)).toEqual([...ACCENTS].sort());
    expect(values(RADIUS_OPTIONS)).toEqual([...RADII].sort());
    expect(values(DENSITY_OPTIONS)).toEqual([...DENSITIES].sort());
    expect(values(FONT_OPTIONS)).toEqual([...FONTS].sort());
  });

  it('knows when the appearance is back to defaults', () => {
    expect(isDefaultAppearance(DEFAULT_APPEARANCE)).toBe(true);
    expect(isDefaultAppearance({ ...DEFAULT_APPEARANCE, radius: 'lg' })).toBe(false);
  });
});

import type { SidebarPreset } from '@taskflow/shared-types';
import { CheckIcon, PaletteIcon, RotateCcwIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import type { Appearance } from '@/core/preferences/appearance';
import { usePreferenceMutations, usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/errors';
import { AppearancePreview } from '../components/appearance-preview';
import { ThemeCard } from '../components/theme-card';
import { ACCENT_OPTIONS, DEFAULT_APPEARANCE, DENSITY_OPTIONS, FONT_OPTIONS, isDefaultAppearance, RADIUS_OPTIONS, SIDEBAR_OPTIONS, THEME_OPTIONS } from '../lib/appearance-options';

const PRESET_OPTIONS: { value: SidebarPreset; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'manager', label: 'Manager' },
];
const PRESET_HINT: Record<SidebarPreset, string> = {
  default: 'Everything: your work, projects, the workspace and people.',
  minimal: 'Just your work and your projects. The rest stays one click away on the rail.',
  manager: 'People first (directory, approvals, attendance), then projects and the workspace.',
};

function Setting({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <div>
        <h2 id={id} className="text-sm font-medium">
          {label}
        </h2>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Settings → Appearance: theme, accent, radius, density and font. Saved to the account, applied at once. */
export function AppearancePage() {
  const { theme, accent, density, radius, font, sidebarCollapsed, sidebarPreset } = usePreferences();
  const current: Appearance = { theme, accent, density, radius, font };
  const { update } = usePreferenceMutations();

  const save = (change: Partial<Appearance>) => update.mutate(change, { onError: (error) => toast.error(getErrorMessage(error)) });

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Appearance"
        description="Customize how TaskFlow looks on your devices. Saved to your account."
        icon={<PaletteIcon className="size-5 text-muted-foreground" />}
        actions={
          <Button variant="outline" size="sm" disabled={isDefaultAppearance(current) || update.isPending} onClick={() => save(DEFAULT_APPEARANCE)}>
            <RotateCcwIcon /> Reset to defaults
          </Button>
        }
      />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-8">
          <Setting id="appearance-theme" label="Theme" hint="System follows your device's light or dark setting.">
            <div role="radiogroup" aria-labelledby="appearance-theme" className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map((option) => (
                <ThemeCard key={option.value} theme={option.value} label={option.label} selected={theme === option.value} onSelect={() => save({ theme: option.value })} />
              ))}
            </div>
          </Setting>

          <Setting id="appearance-accent" label="Accent" hint="Used for primary buttons, focus rings and highlights.">
            <div role="radiogroup" aria-labelledby="appearance-accent" className="flex flex-wrap gap-2">
              {ACCENT_OPTIONS.map((option) => {
                const selected = accent === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => save({ accent: option.value })}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-md border pr-3 pl-2 text-sm transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-primary-soft focus-visible:outline-none',
                      selected ? 'border-border-strong bg-selected font-medium' : 'hover:bg-muted',
                    )}
                  >
                    <span className="grid size-[18px] place-items-center rounded-full text-white" style={{ background: option.swatch }}>
                      {selected ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Setting>

          <div className="grid gap-8 sm:grid-cols-2">
            <Setting id="appearance-radius" label="Corner radius">
              <Segmented className="self-start" label="Corner radius" size="md" value={radius} options={RADIUS_OPTIONS} onChange={(value) => save({ radius: value })} />
            </Setting>
            <Setting id="appearance-density" label="Density">
              <Segmented className="self-start" label="Density" size="md" value={density} options={DENSITY_OPTIONS} onChange={(value) => save({ density: value })} />
            </Setting>
          </div>

          <Setting id="appearance-sidebar" label="Sidebar" hint="The app rail always stays; this shows or hides the side panel next to it.">
            <Segmented
              className="self-start"
              label="Sidebar"
              size="md"
              value={sidebarCollapsed ? 'rail' : 'panel'}
              options={SIDEBAR_OPTIONS}
              onChange={(value) => update.mutate({ sidebarCollapsed: value === 'rail' }, { onError: (error) => toast.error(getErrorMessage(error)) })}
            />
          </Setting>

          <Setting id="appearance-sidebar-preset" label="Sidebar layout" hint={PRESET_HINT[sidebarPreset]}>
            <Segmented
              className="self-start"
              label="Sidebar layout"
              size="md"
              value={sidebarPreset}
              options={PRESET_OPTIONS}
              onChange={(value) => update.mutate({ sidebarPreset: value }, { onError: (error) => toast.error(getErrorMessage(error)) })}
            />
          </Setting>

          <Setting id="appearance-font" label="Font" hint="IDs, times and code always use Geist Mono.">
            <div role="radiogroup" aria-labelledby="appearance-font" className="grid gap-3 sm:grid-cols-3">
              {FONT_OPTIONS.map((option) => {
                const selected = font === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => save({ font: option.value })}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-primary-soft focus-visible:outline-none',
                      selected ? 'border-ring bg-primary-soft' : 'hover:bg-muted',
                    )}
                  >
                    <span className="text-2xl font-semibold tracking-tight" style={{ fontFamily: option.family }}>
                      Aa
                    </span>
                    <span className="text-sm" style={{ fontFamily: option.family }}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Setting>
        </div>

        <aside aria-label="Live preview" className="flex flex-col gap-3 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">Live preview</span>
            <span className="text-xs text-muted-foreground">your workbench</span>
          </div>
          <AppearancePreview />
          <p className="text-xs text-muted-foreground">Changes apply instantly and follow you to every device you sign in on.</p>
        </aside>
      </div>
    </div>
  );
}

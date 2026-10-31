const COLUMNS = [
  { name: 'To do', color: 'var(--status-todo)', cards: [{ id: 'TF-151', title: 'Rotate staging keys' }, { id: 'TF-148', title: 'Audit SSO scopes' }] },
  { name: 'In progress', color: 'var(--status-in-progress)', cards: [{ id: 'TF-142', title: 'Fix login crash on SSO redirect' }] },
  { name: 'Done', color: 'var(--status-done)', cards: [{ id: 'TF-139', title: 'Ship sprint report' }, { id: 'TF-136', title: 'Tidy flaky e2e' }] },
];

/**
 * A miniature workbench drawn with the live tokens, so it changes the moment a setting does.
 * Decorative: screen readers get the settings themselves, not this picture.
 */
export function AppearancePreview() {
  return (
    <div aria-hidden className="overflow-hidden rounded-xl border bg-background text-foreground shadow-popover">
      <div className="flex h-7 items-end gap-1 border-b bg-rail px-2 text-[10.5px]">
        <span className="flex h-[22px] items-center gap-1 rounded-t-md border border-b-0 bg-background px-2">
          <span className="size-1.5 rounded-full bg-primary" />
          Issues
        </span>
        <span className="flex h-[22px] items-center px-2 text-muted-foreground">#platform</span>
        <span className="flex h-[22px] items-center gap-1 px-2 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-critical" />
          Stand-up
        </span>
      </div>
      <div className="flex h-56">
        <div className="flex w-9 flex-col items-center gap-2 border-r bg-rail pt-2">
          <span className="size-[18px] rounded-sm bg-primary" />
          <span className="size-3.5 rounded-sm bg-selected" />
          <span className="size-3.5 rounded-sm bg-selected" />
        </div>
        <div className="grid flex-1 grid-cols-3 gap-2 p-2.5">
          {COLUMNS.map((column) => (
            <div key={column.name} className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1 font-mono text-[8.5px] font-semibold tracking-wider uppercase">
                <span className="size-1.5 rounded-full" style={{ background: column.color }} />
                {column.name}
              </span>
              {column.cards.map((card) => (
                <div key={card.id} className="rounded-md border bg-card p-1.5 text-[9.5px] leading-snug" style={{ minHeight: 'calc(var(--row-height) * 1.1)' }}>
                  <span className="mr-1 font-mono text-subtle-foreground">{card.id}</span>
                  {card.title}
                  <div className="mt-1.5 h-2.5 w-8 rounded-full bg-primary-soft" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

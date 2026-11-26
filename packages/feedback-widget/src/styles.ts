/** The widget's styles, inside its shadow root. `accent` is a validated colour value. */
export const STYLES = (accent: string | null) => `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
.launcher, .panel { position: fixed; z-index: 2147483646; --accent: ${accent ?? '#ea580c'}; }
.launcher {
  bottom: 20px; padding: 10px 16px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--accent); color: #fff; font-size: 14px; font-weight: 600;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .2);
}
.launcher:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.right { right: 20px; }
.left { left: 20px; }
.panel {
  bottom: 72px; width: min(380px, calc(100vw - 32px)); max-height: calc(100vh - 100px); overflow: auto;
  background: #fff; color: #16181d; border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, .2); font-size: 14px; line-height: 1.45;
}
.panel[hidden] { display: none; }
h2 { font-size: 16px; margin: 0 0 4px; }
p { margin: 0 0 8px; }
form { display: grid; gap: 10px; }
.field { display: grid; gap: 4px; font-size: 13px; font-weight: 600; }
.field small { font-weight: 400; color: #6b7280; }
input[type='text'], input[type='email'], select, textarea {
  width: 100%; font: inherit; font-size: 14px; color: inherit; background: #fff;
  border: 1px solid #d4d4d8; border-radius: 8px; padding: 7px 9px;
}
textarea { resize: vertical; }
.row { display: flex; gap: 8px; align-items: center; }
.row > .field { flex: 1; min-width: 0; }
.row.end { justify-content: flex-end; }
.check { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: #52525b; }
.check input { margin-top: 2px; }
button.primary, button.secondary { font: inherit; font-size: 14px; border-radius: 8px; padding: 7px 14px; cursor: pointer; }
button.primary { border: 0; background: var(--accent); color: #fff; font-weight: 600; }
button.primary:disabled { opacity: .6; cursor: default; }
button.secondary { border: 1px solid #d4d4d8; background: #fff; color: inherit; }
.muted { color: #6b7280; font-size: 12px; }
.status { min-height: 1em; font-size: 13px; color: #b42318; margin: 0; }
.trap { position: absolute; left: -10000px; width: 1px; height: 1px; opacity: 0; }
a { color: var(--accent); }
@media (prefers-color-scheme: dark) {
  .panel { background: #17181c; color: #ececef; border-color: #2e3036; }
  input[type='text'], input[type='email'], select, textarea, button.secondary { background: #1f2126; border-color: #3a3d44; color: inherit; }
  .muted, .field small, .check { color: #9ca3af; }
  .status { color: #ff8b8b; }
}
`;

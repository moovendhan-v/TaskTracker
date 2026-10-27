/**
 * How work is organised inside a project (space): folders hold lists and other
 * folders, lists hold tasks, and docs hang off the space in their own tree.
 */

/** Deepest a folder can sit (a folder directly under the space is depth 1). */
export const FOLDER_MAX_DEPTH = 3;
/** Most folders one space can have. */
export const FOLDERS_PER_SPACE_MAX = 100;

/**
 * Icons people can pick for spaces, folders, lists and docs. Clients map each
 * key to a drawing; storing a key (never markup or a URL) keeps icons safe to render.
 */
export const ICON_KEYS = [
  'folder',
  'list',
  'rocket',
  'target',
  'flag',
  'star',
  'heart',
  'zap',
  'bug',
  'code',
  'terminal',
  'database',
  'server',
  'cloud',
  'shield',
  'lock',
  'megaphone',
  'mail',
  'message',
  'phone',
  'palette',
  'pen',
  'image',
  'camera',
  'video',
  'music',
  'book',
  'file',
  'notebook',
  'graduation',
  'briefcase',
  'building',
  'store',
  'cart',
  'wallet',
  'chart',
  'pie',
  'trending',
  'calendar',
  'clock',
  'users',
  'user',
  'handshake',
  'headset',
  'globe',
  'map',
  'compass',
  'home',
  'lightbulb',
  'puzzle',
  'wrench',
  'settings',
  'box',
  'truck',
  'leaf',
  'sun',
  'moon',
  'coffee',
  'gift',
  'trophy',
] as const;
export type IconKey = (typeof ICON_KEYS)[number];

export function isIconKey(value: string): value is IconKey {
  return (ICON_KEYS as readonly string[]).includes(value);
}

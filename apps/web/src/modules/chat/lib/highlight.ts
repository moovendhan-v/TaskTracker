/** Splits text into parts, marking the ones that start with any of the searched words (case-insensitive). */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const words = (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(Boolean);
  if (words.length === 0) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  for (const token of text.split(/([\p{L}\p{N}]+)/u)) {
    if (!token) continue;
    const hit = words.some((word) => token.toLowerCase().startsWith(word));
    const last = parts[parts.length - 1];
    if (last && last.hit === hit && !hit) last.text += token;
    else parts.push({ text: token, hit });
  }
  return parts;
}

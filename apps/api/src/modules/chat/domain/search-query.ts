/** "deploy fail" → "deploy:* & fail:*". Words are letters and digits only, so no tsquery syntax gets through. */
export function toPrefixQuery(text: string): string {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => word.length <= 40).slice(0, 8);
  return words.map((word) => `${word}:*`).join(' & ');
}

/** Escapes LIKE wildcards so user search text matches literally. Use with a bound parameter. */
export const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

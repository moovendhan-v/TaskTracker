/**
 * Cleans user-written markdown before it's stored. Rendering stays safe on its
 * own (the web app never renders raw HTML), so this is a second layer.
 */
export abstract class ContentSanitizer {
  abstract sanitize(markdown: string): string;
}

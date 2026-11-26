import type { BugCaptureInput } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

/** The capture arrives as JSON; anything that isn't an object of arrays is refused here, and every entry is re-validated and redacted in BugPolicy. */
export function parseCapture(json: string | null | undefined): BugCaptureInput | null {
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw DomainError.invalid('The captured diagnostics are not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw DomainError.invalid('The captured diagnostics are not in the expected shape');
  const value = parsed as Record<string, unknown>;
  const list = (key: string) => (Array.isArray(value[key]) ? (value[key] as never[]).filter((entry) => entry && typeof entry === 'object') : []);
  return { console: list('console'), network: list('network'), actions: list('actions') };
}


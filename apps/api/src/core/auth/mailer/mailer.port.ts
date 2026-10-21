/** Sends account emails. Swap adapters without touching auth code. */
export abstract class Mailer {
  abstract sendPasswordReset(to: string, url: string): Promise<void>;
}

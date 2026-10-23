/** Sends account emails. Swap adapters without touching auth code. */
export abstract class Mailer {
  abstract sendPasswordReset(to: string, url: string): Promise<void>;
  /** Proves the person owns the address; workspace invites only reach confirmed emails. */
  abstract sendEmailVerification(to: string, url: string): Promise<void>;
}

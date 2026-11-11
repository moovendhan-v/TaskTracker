/** Receives the relay messages other API instances sent for one page. */
export type RelayHandler = (message: Uint8Array) => void;

/**
 * Carries live editing messages for a page between API instances, so people editing the
 * same page on different instances see each other (C5). Messages are opaque bytes here;
 * the service encodes and checks them.
 */
export abstract class LiveDocRelay {
  /** False when there is only this instance (no Redis): nothing is sent anywhere. */
  abstract readonly enabled: boolean;
  /** This instance's id, so it can ignore its own messages. */
  abstract readonly instanceId: string;
  /** Starts receiving a page's messages. Resolves once other instances' messages will arrive. */
  abstract subscribe(key: string, handler: RelayHandler): Promise<void>;
  /** Stops, unless another handler has taken the page over since. */
  abstract unsubscribe(key: string, handler: RelayHandler): Promise<void>;
  /**
   * Takes the page's save lock, so only one instance saves it at a time. Resolves with a
   * function that releases it, or null while another instance holds it. Throws when Redis
   * can't answer (the caller saves anyway: a double save is better than a lost one).
   */
  abstract lock(key: string): Promise<(() => Promise<void>) | null>;
  /** Called after the connection to other instances came back, when messages may have been missed. */
  abstract onReconnect(callback: () => void): void;
  /** Sends to every instance with the page open (including this one, which ignores it). Never throws. */
  abstract publish(key: string, message: Uint8Array): void;
}

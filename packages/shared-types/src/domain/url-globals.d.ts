/**
 * URL and URLSearchParams exist in every runtime this package runs in (browsers and Node), but the
 * package compiles without DOM or Node typings, so only the parts it uses are declared here.
 */
declare global {
  class URLSearchParams {
    constructor(init?: string);
    keys(): IterableIterator<string>;
    set(name: string, value: string): void;
    toString(): string;
  }
  class URL {
    constructor(url: string, base?: string);
    username: string;
    password: string;
    hash: string;
    pathname: string;
    search: string;
    readonly searchParams: URLSearchParams;
    toString(): string;
  }
}
export {};

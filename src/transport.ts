// Requests over `fetch`, and the API's answers as JSON or typed errors.
//
// `fetch` is the runtime's, or one passed in (`new Client({ fetch })`): how
// the tests run without a network, and how a caller could put their own HTTP
// stack underneath.

import { fromResponse, RateLimited, TransportError, Unavailable } from "./errors.ts";
import type { TemporalLike } from "./generated/models.ts";

export const DEFAULT_URL = "https://api.diurn.io";
export const VERSION = "0.1.0";

/** A MIC list longer than this is sent as the POST form, past URL limits. */
const POST_ABOVE = 40;

/** How a client is set up. Every field is optional. */
export interface ClientOptions {
  /** The API key; by default `DIURN_API_KEY` where the runtime has an
   * environment. A free one is at https://diurn.io/signin/. */
  apiKey?: string;
  /** The API's address; by default `DIURN_API_URL`, else https://api.diurn.io. */
  baseUrl?: string;
  /** How long one request may take, in milliseconds; 30,000 by default. */
  timeoutMs?: number;
  /** How many times to retry what waiting can fix; 0 by default. */
  retries?: number;
  /** The longest single wait before a retry, in milliseconds; 60,000 by
   * default. A server asking for longer gets its error thrown instead. */
  maxWaitMs?: number;
  /** The first wait after a 503 or a failed connection, doubling each time;
   * 500 milliseconds by default. */
  backoffMs?: number;
  /** The `Temporal` to use where the runtime has none (`temporal-polyfill`). */
  temporal?: TemporalLike;
  /** The `fetch` to send with; the runtime's by default. */
  fetch?: typeof fetch;
}

/** A parameter's value; `undefined` and empty lists are left out. */
export type Param = string | number | boolean | readonly string[] | undefined;

export interface Request {
  path: string;
  params?: Record<string, Param>;
  /** Several MICs: GET for a short list, the POST form for a long one. */
  many?: boolean;
}

function env(name: string): string | undefined {
  const process = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const value = process?.env?.[name];
  return value ? value : undefined;
}

export class Transport {
  readonly apiKey: string | undefined;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly retries: number;
  readonly maxWaitMs: number;
  readonly backoffMs: number;
  readonly T: TemporalLike;
  readonly fetch: typeof fetch;
  /** The headers of the last response, lower-cased. */
  lastHeaders: Record<string, string> = {};

  constructor(options: ClientOptions, T: TemporalLike) {
    this.apiKey = options.apiKey ?? env("DIURN_API_KEY");
    this.baseUrl = (options.baseUrl ?? env("DIURN_API_URL") ?? DEFAULT_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.retries = options.retries ?? 0;
    this.maxWaitMs = options.maxWaitMs ?? 60_000;
    this.backoffMs = options.backoffMs ?? 500;
    this.T = T;
    const f = options.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) throw new TransportError("this runtime has no fetch: pass one as `fetch`");
    this.fetch = f;
  }

  /** The JSON answer, retrying what waiting can fix as configured. */
  async get(request: Request): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.once(request);
      } catch (error) {
        const wait = this.wait(error, attempt);
        if (wait === undefined) throw error;
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  /**
   * How long to wait before retrying, or `undefined` to throw now.
   *
   * Retried is what waiting can fix: `rate_limited`, after the server's
   * `Retry-After`; a 503 or a failed connection, backing off from `backoffMs`.
   * A plan's refusal is never retried, and a wait longer than `maxWaitMs` is
   * thrown rather than slept. Every request is a read, so a retry is safe.
   */
  wait(error: unknown, attempt: number): number | undefined {
    if (attempt >= this.retries) return undefined;
    let told: number | undefined;
    if (error instanceof RateLimited || error instanceof Unavailable) told = error.retryAfterMs;
    else if (!(error instanceof TransportError)) return undefined;
    if (told !== undefined) return told <= this.maxWaitMs ? told : undefined;
    return Math.min(this.backoffMs * 2 ** attempt, this.maxWaitMs);
  }

  private async once(request: Request): Promise<unknown> {
    const params = Object.entries(request.params ?? {}).filter(
      ([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0),
    ) as [string, Exclude<Param, undefined>][];
    const mics = request.params?.["mics"];
    const post = request.many === true && Array.isArray(mics) && mics.length > POST_ABOVE;
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) headers["authorization"] = `Bearer ${this.apiKey}`;
    let url = this.baseUrl + request.path;
    let body: string | undefined;
    if (post) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(Object.fromEntries(params));
    } else if (params.length > 0) {
      const query = new URLSearchParams(params.map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)]));
      url += `?${query}`;
    }
    const method = post ? "POST" : "GET";
    let response: Response;
    try {
      response = await this.fetch(url, { method, headers, body, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (e) {
      throw new TransportError(`${method} ${url}: ${(e as Error).message}`);
    }
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });
    this.lastHeaders = responseHeaders;
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    if (response.ok) {
      if (parsed === undefined) throw new TransportError(`${method} ${url}: answered ${response.status} without JSON`);
      return parsed;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      if (response.status >= 500) throw new TransportError(`${method} ${url}: answered ${response.status}`);
      parsed = {};
    }
    const retryAfter = Number.parseFloat(responseHeaders["retry-after"] ?? "");
    throw fromResponse(
      response.status,
      parsed as Record<string, unknown>,
      this.T,
      Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
    );
  }
}

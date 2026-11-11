// A fake API for the tests: a local HTTP server answering from the responses
// recorded in test/fixtures/ (`node scripts/record.mjs <url>`), so nothing here
// needs a network or a key. The same fixtures diurn-rs's tests use.

import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Temporal } from "temporal-polyfill";

import { Client, type ClientOptions } from "../src/index.ts";

const FIXTURES = path.join(import.meta.dirname, "fixtures");

/** A path and its query with the pairs sorted, so a request is found
 * whatever order its parameters were written in. */
function key(pathname: string, query: string): string {
  const pairs = [...new URLSearchParams(query)].sort(([a, x], [b, y]) => (a + x < b + y ? -1 : 1));
  return `${pathname}?${pairs.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

const index: Record<string, string> = JSON.parse(fs.readFileSync(path.join(FIXTURES, "index.json"), "utf8"));
const recorded = new Map<string, unknown>();
for (const [p, file] of Object.entries(index)) {
  const [pathname = "", query = ""] = p.split("?");
  recorded.set(key(pathname, query), JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8")));
}

export function fixture(file: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8"));
}

/** A recorded answer, or for a sessions range not recorded as such, one
 * assembled from the recorded years it spans. */
function answer(pathname: string, query: string): unknown {
  const hit = recorded.get(key(pathname, query));
  if (hit !== undefined) return hit;
  if (!pathname.startsWith("/v1/venues/") || !pathname.endsWith("/sessions")) return undefined;
  const params = new URLSearchParams(query);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const days: unknown[] = [];
  let first: any;
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
    const whole: any = recorded.get(key(pathname, `from=${year}-01-01&to=${year}-12-31`));
    if (!whole) return undefined;
    first ??= whole;
    days.push(...whole.days.filter((d: any) => from <= d.date && d.date <= to));
  }
  return { ...first, days };
}

/** A reply a test puts in front of the fixtures. */
export interface Reply {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface Seen {
  method: string;
  path: string;
  body: string;
}

/** A server answering from the fixtures. `override(path, ...replies)` answers a
 * path with the replies in turn, the last repeated. */
export class FakeApi {
  readonly seen: Seen[] = [];
  private readonly overrides = new Map<string, Reply[]>();
  private server!: http.Server;
  url = "";

  static async start(): Promise<FakeApi> {
    const api = new FakeApi();
    api.server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const url = new URL(req.url ?? "/", "http://x");
        api.seen.push({ method: req.method ?? "GET", path: url.pathname + url.search, body });
        const queued = api.overrides.get(url.pathname);
        let reply: Reply;
        if (queued && queued.length > 0) {
          reply = (queued.length > 1 ? queued.shift() : queued[0]) as Reply;
        } else {
          const found = answer(url.pathname, url.search.slice(1));
          reply =
            found !== undefined
              ? { status: 200, body: found }
              : url.pathname === "/v1/usage"
                ? { status: 404, body: { error: "not_metered", message: "no key store" } }
                : { status: 404, body: { error: "not_found", message: url.pathname + url.search } };
        }
        res.writeHead(reply.status, { "content-type": "application/json", ...reply.headers });
        res.end(reply.body === undefined ? "" : JSON.stringify(reply.body));
      });
    });
    await new Promise<void>((resolve) => api.server.listen(0, "127.0.0.1", resolve));
    api.url = `http://127.0.0.1:${(api.server.address() as AddressInfo).port}`;
    return api;
  }

  override(pathname: string, ...replies: Reply[]): void {
    this.overrides.set(pathname, replies);
  }

  client(options: ClientOptions = {}): Client {
    return new Client({ apiKey: "diurn_key_test", baseUrl: this.url, temporal: Temporal, ...options });
  }

  count(pathname: string): number {
    return this.seen.filter((s) => s.path.split("?")[0] === pathname).length;
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

export const date = (s: string): Temporal.PlainDate => Temporal.PlainDate.from(s);
export const instant = (s: string): Temporal.Instant => Temporal.Instant.from(s);

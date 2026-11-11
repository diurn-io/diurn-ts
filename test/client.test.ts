// The client against recorded responses: every operation decodes, the
// answers are the API's, errors are typed, and retries wait as they should.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  AuthError,
  Client,
  Indeterminate,
  InvalidMic,
  MicCapExceeded,
  NoTemporal,
  OutOfWindow,
  OverLimit,
  RateLimited,
  Unavailable,
  UnknownVenue,
} from "../src/index.ts";
import { date, FakeApi, fixture, instant } from "./support.ts";

let api: FakeApi;
before(async () => {
  api = await FakeApi.start();
});
after(() => api.close());

describe("operations", () => {
  it("decode their recorded answers", async () => {
    const c = api.client();
    await c.health();
    const venue = await c.venue("xnys");
    assert.equal(venue.mic, "XNYS");
    assert.equal(venue.timezone, "America/New_York");
    assert.equal((await c.venues({ country: "JP", limit: 5 })).venues.length, 5);
    const year = await c.sessions("XNYS", "2026-01-01", "2026-12-31");
    assert.equal(year.days.length, 365);
    assert.ok(year.days[0]?.date.equals(date("2026-01-01")), "dates are Temporal.PlainDate");
    assert.equal((await c.day("XNYS", "2026-11-26")).kind, "holiday");
    await c.sessionsBulk(["XNYS", "XLON"], "2026-11-20", "2026-11-30");
    await c.tradingDays(["XNYS", "XLON"], "2026-11-20", "2026-11-30");
  });

  it("give instants in the venue's zone", async () => {
    const c = api.client();
    const status = await c.status("XNYS", { at: "2026-11-27T15:00:00Z" });
    assert.equal(status.state, "running");
    assert.ok(status.at.equals(instant("2026-11-27T15:00:00Z")));
    const close = (await c.nextClose("XNYS", "2026-11-27T15:00:00Z")).at;
    assert.equal(close?.toString(), "2026-11-27T13:00:00-05:00[America/New_York]");
    assert.equal(status.day.sessions[0]?.close.toString(), close?.toString());
  });

  it("answer trading-day arithmetic and many venues", async () => {
    const c = api.client();
    const next = await c.nextTradingDay("XNYS", "2026-11-25");
    assert.equal(next.date.toString(), "2026-11-27");
    assert.equal(next.skipped[0]?.reason, "Thanksgiving Day");
    assert.equal((await c.countTradingDays("XNYS", "2026-11-01", "2026-11-30")).count, 20);
    assert.equal((await c.jointNextTradingDay(["XNYS", "XLON"], "2026-12-23", { n: 2 })).date.toString(), "2026-12-29");
    const statuses = await c.statuses(["XNYS", "XLON"], { at: "2026-11-26T15:00:00Z" });
    assert.equal(statuses.venues["XNYS"]?.state, "closed");
    assert.equal(statuses.venues["XLON"]?.state, "running");
    const rows = (await c.exceptions(["XNYS", "XLON"], "2026-11-20", "2026-12-31")).days;
    const keys = rows.map((r) => `${r.date} ${r.mic}`);
    assert.deepEqual(keys, [...keys].sort(), "by date, then MIC");
  });

  it("post a long MIC list", async () => {
    api.override("/v1/status", { status: 200, body: { at: "2026-11-26T15:00:00Z", venues: {} } });
    const many = Array.from({ length: 41 }, (_, i) => `X${String(i).padStart(3, "0")}`);
    await api.client().statuses(many);
    const posted = api.seen.at(-1);
    assert.equal(posted?.method, "POST");
    assert.equal(JSON.parse(posted?.body ?? "{}").mics.length, 41);
  });

  it("check a MIC before any request", async () => {
    const before = api.seen.length;
    await assert.rejects(api.client().venue("NYSE!"), InvalidMic);
    assert.equal(api.seen.length, before);
  });

  it("need a Temporal", () => {
    assert.throws(() => new Client({ baseUrl: api.url }), NoTemporal, "this Node has none built in");
  });

  it("keep the last response's headers", async () => {
    api.override("/v1/venues/XHKG", { status: 200, body: fixture("v1_venues_XHKG.json"), headers: { "diurn-mics-day": "1/5" } });
    const c = api.client();
    await c.venue("XHKG");
    assert.equal(c.lastHeaders["diurn-mics-day"], "1/5");
  });
});

describe("errors", () => {
  async function refusal(status: number, body: unknown): Promise<unknown> {
    api.override("/v1/venues/XTKS", { status, body });
    try {
      await api.client().venue("XTKS");
      return undefined;
    } catch (e) {
      return e;
    } finally {
      api.override("/v1/venues/XTKS");
    }
  }

  it("carry their numbers", async () => {
    const cap = await refusal(429, {
      error: "mic_cap_exceeded",
      message: "",
      mics_in_use: ["XLON", "XTKS"],
      resets_at: "2026-11-28T09:00:00Z",
      limit: { kind: "mics_day", used: 2, max: 2 },
    });
    assert.ok(cap instanceof MicCapExceeded && cap instanceof OverLimit);
    assert.deepEqual(cap.micsInUse, ["XLON", "XTKS"]);
    assert.ok(cap.resetsAt?.equals(instant("2026-11-28T09:00:00Z")));
    assert.deepEqual(cap.limit, { kind: "mics_day", used: 2, max: 2 });

    const window = await refusal(403, { error: "out_of_window", message: "", allowed: { from: "2026-01-01", to: null } });
    assert.ok(window instanceof OutOfWindow);
    assert.ok(window.allowedFrom?.equals(date("2026-01-01")));
    assert.equal(window.allowedTo, undefined);

    const indeterminate = await refusal(422, { error: "indeterminate", message: "", date: "2100-01-01" });
    assert.ok(indeterminate instanceof Indeterminate);
    assert.ok(indeterminate.date?.equals(date("2100-01-01")));
    assert.equal(indeterminate.response?.status, 422);

    assert.ok((await refusal(401, { error: "needs_key", message: "" })) instanceof AuthError);
    assert.ok((await refusal(404, { error: "unknown_mic", message: "" })) instanceof UnknownVenue);
    assert.ok((await refusal(429, { error: "venue_days_exceeded", message: "" })) instanceof OverLimit);
    assert.ok((await refusal(503, { error: "as_of_unavailable", message: "" })) instanceof Unavailable);
  });
});

describe("retries", () => {
  const RATE = (after: string) => ({
    status: 429,
    body: { error: "rate_limited", message: "slow down" },
    headers: { "retry-after": after },
  });
  const DOWN = { status: 503, body: { error: "as_of_unavailable", message: "" } };
  const OK = { status: 200, body: fixture("v1_venues_XCEC.json") };

  async function attempt(replies: object[], retries: number): Promise<{ error: unknown; sent: number }> {
    api.override("/v1/venues/XCEC", ...(replies as never[]));
    const before = api.count("/v1/venues/XCEC");
    let error: unknown;
    try {
      await api.client({ retries, backoffMs: 1 }).venue("XCEC");
    } catch (e) {
      error = e;
    }
    api.override("/v1/venues/XCEC");
    return { error, sent: api.count("/v1/venues/XCEC") - before };
  }

  it("wait out a rate limit, then answer", async () => {
    const { error, sent } = await attempt([RATE("0"), OK], 3);
    assert.equal(error, undefined);
    assert.equal(sent, 2);
  });

  it("back off from failures in transit, and run out", async () => {
    assert.deepEqual(await attempt([DOWN, DOWN, OK], 3), { error: undefined, sent: 3 });
    const { error, sent } = await attempt([DOWN], 2);
    assert.ok(error instanceof Unavailable);
    assert.equal(sent, 3, "the first try and two retries");
  });

  it("never retry what waiting cannot fix", async () => {
    const cap = await attempt([{ status: 429, body: { error: "mic_cap_exceeded", message: "" } }, OK], 3);
    assert.ok(cap.error instanceof MicCapExceeded);
    assert.equal(cap.sent, 1);
    const long = await attempt([RATE("120"), OK], 3);
    assert.ok(long.error instanceof RateLimited);
    assert.equal(long.error.retryAfterMs, 120_000);
    assert.equal(long.sent, 1, "a wait longer than maxWaitMs is thrown, not slept");
    const none = await attempt([RATE("0"), OK], 0);
    assert.ok(none.error instanceof RateLimited);
    assert.equal(none.sent, 1, "no retry unless asked");
  });
});

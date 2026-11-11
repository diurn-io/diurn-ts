// The calendar's answers, from recorded XNYS, XTKS, XHKG, XCEC and XNSE
// responses: the questions diurn-py's and diurn-rs's tests ask, with the same
// answers.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { Indeterminate, InvalidArgument, NotASession, OutsideLoaded, UnknownVenue } from "../src/index.ts";
import { FakeApi, fixture } from "./support.ts";

let api: FakeApi;
before(async () => {
  api = await FakeApi.start();
});
after(() => api.close());

const cal = (mic: string) => api.client().calendar(mic, "2026-01-01", "2026-12-31");
const ymd = (dates: { toString(): string }[]) => dates.map(String);
const hm = (z: Temporal.ZonedDateTime | undefined) => z?.toPlainTime().toString().slice(0, 5);

describe("calendar", () => {
  it("knows Thanksgiving", async () => {
    const x = await cal("XNYS");
    assert.equal(x.isSession("2026-11-26"), false);
    assert.equal(x.isSession("2026-11-27"), true, "an early close is a session");
    assert.equal(String(x.nextSession("2026-11-25")), "2026-11-27");
    assert.equal(String(x.previousSession("2026-11-27")), "2026-11-25");
    assert.equal(String(x.nextSession("2026-11-26")), "2026-11-27", "need not be a session");
    assert.deepEqual(ymd(x.sessionsInRange("2026-11-24", "2026-11-30")), [
      "2026-11-24",
      "2026-11-25",
      "2026-11-27",
      "2026-11-30",
    ]);
  });

  it("moves to a session, and windows", async () => {
    const x = await cal("XNYS");
    assert.equal(String(x.dateToSession("2026-11-27")), "2026-11-27");
    assert.equal(String(x.dateToSession("2026-11-26", "next")), "2026-11-27");
    assert.equal(String(x.dateToSession("2026-11-26", "previous")), "2026-11-25");
    assert.throws(() => x.dateToSession("2026-11-26"), NotASession);
    assert.deepEqual(ymd(x.sessionsWindow("2026-11-25", 3)), ["2026-11-25", "2026-11-27", "2026-11-30"]);
    assert.deepEqual(ymd(x.sessionsWindow("2026-11-27", -2)), ["2026-11-25", "2026-11-27"]);
  });

  it("walks across a year when both are loaded, and never fetches past one", async () => {
    const c = api.client();
    const two = await c.calendar("XNYS", "2026-01-01", "2027-12-31");
    assert.equal(String(two.nextSession("2026-12-31")), "2027-01-04", "New Year's Day, then a weekend");
    const one = await c.calendar("XNYS", "2026-01-01", "2026-12-31");
    assert.throws(
      () => one.nextSession("2026-12-31"),
      (e: unknown) => e instanceof OutsideLoaded && String(e.date) === "2027-01-01" && String(e.to) === "2026-12-31",
    );
  });

  it("keeps the venue's zone on instants", async () => {
    const x = await cal("XNYS");
    assert.equal(x.nextClose("2026-11-27T15:00:00Z").toString(), "2026-11-27T13:00:00-05:00[America/New_York]");
    assert.equal(String(x.nextOpen("2026-11-26T12:00:00Z").toPlainDate()), "2026-11-27", "Friday's, after Thanksgiving");
    assert.equal(x.isOpenAtTime("2026-11-27T17:30:00Z"), true);
    assert.equal(x.isOpenAtTime("2026-11-27T18:30:00Z"), false, "after the 13:00 close");
  });

  it("lays out breaks as exchange_calendars does", async () => {
    const tokyo = await cal("XTKS");
    const [r] = tokyo.schedule("2026-11-02", "2026-11-02");
    assert.deepEqual([hm(r?.open), hm(r?.breakStart), hm(r?.breakEnd), hm(r?.close)], ["09:00", "11:30", "12:30", "15:30"]);
    assert.deepEqual(tokyo.schedule("2026-11-03", "2026-11-03"), [], "Culture Day");
    const [holiday] = tokyo.schedule("2026-11-03", "2026-11-03", { allDays: true });
    assert.equal(holiday?.kind, "holiday");
    assert.ok(holiday?.open === undefined && holiday.reason);
    const hk = await cal("XHKG");
    const [eve] = hk.schedule("2026-12-24", "2026-12-24");
    assert.equal(eve?.kind, "early_close");
    assert.equal(eve?.breakStart, undefined, "a close inside the lunch break has no break");
    assert.equal(hm(eve?.close), "12:10");
  });

  it("gives one session's times, and the distance between two", async () => {
    const tokyo = await cal("XTKS");
    assert.equal(hm(tokyo.sessionOpen("2026-11-02")), "09:00");
    assert.equal(hm(tokyo.sessionBreakStart("2026-11-02")), "11:30");
    assert.equal(hm(tokyo.sessionBreakEnd("2026-11-02")), "12:30");
    assert.equal(hm(tokyo.sessionClose("2026-11-02")), "15:30");
    const nyse = await cal("XNYS");
    assert.equal(nyse.sessionBreakStart("2026-11-27"), undefined);
    assert.throws(() => nyse.sessionOpen("2026-11-26"), NotASession);
    assert.equal(nyse.sessionsDistance("2026-11-01", "2026-11-30"), 20);
    assert.equal(nyse.sessionsDistance("2026-11-30", "2026-11-01"), -20);
    assert.equal(nyse.sessionsDistance("2026-11-26", "2026-11-26"), 0);
  });

  it("picks a product's own sessions", async () => {
    const c = api.client();
    const whole = await c.calendar("XCEC", "2026-01-01", "2026-12-31");
    assert.ok(whole.products.includes("Equity Index"));
    assert.equal(whole.day("2026-11-03").sessions[0]?.products, "Equity Index");
    const equity = await c.calendar("XCEC", "2026-01-01", "2026-12-31", { product: "Equity Index" });
    assert.equal(equity.isOpenAtTime("2026-11-03T15:00:00Z"), true);
    const metals = await c.calendar("XCEC", "2026-01-01", "2026-12-31", { product: "Energy and Metals" });
    assert.equal(metals.sessionOpen("2026-11-03"), undefined, "never another product's hours");
    await assert.rejects(c.calendar("XCEC", "2026-01-01", "2026-12-31", { product: "no such product" }), InvalidArgument);
  });

  it("counts a holiday that trades as a session", async () => {
    const nse = await cal("XNSE");
    assert.equal(nse.day("2026-11-08").kind, "holiday");
    assert.equal(nse.isSession("2026-11-08"), true, "Muhurat");
    assert.equal(nse.isOpenAtTime("2026-11-08T09:30:00Z"), true);
    assert.equal(nse.isSession("2026-11-10"), false, "a holiday without one");
    assert.equal(String(nse.nextSession("2026-11-07")), "2026-11-08");
  });

  it("calls an unknown day neither open nor closed", async () => {
    const year = fixture("v1_venues_XNYS_sessions__from-2026-01-01_to-2026-12-31.json");
    year.days = year.days.map((d: { date: string }) =>
      d.date === "2026-11-26" ? { date: d.date, kind: "unknown", verification: "inferredadvisory" } : d,
    );
    api.override("/v1/venues/XNYS/sessions", { status: 200, body: year });
    const x = await cal("XNYS");
    api.override("/v1/venues/XNYS/sessions");
    const isIt = (e: unknown) => e instanceof Indeterminate && String(e.date) === "2026-11-26";
    assert.throws(() => x.isSession("2026-11-26"), isIt);
    assert.throws(() => x.nextSession("2026-11-25"), isIt);
    assert.throws(() => x.sessionsInRange("2026-11-20", "2026-11-30"), isIt);
    assert.throws(() => x.sessionsDistance("2026-11-20", "2026-11-30"), isIt);
  });

  it("is named by its code", async () => {
    const x = await cal("XNYS");
    assert.equal(x.name, "XNYS");
    assert.equal(x.marketName, "NEW YORK STOCK EXCHANGE, INC.");
    assert.equal(x.tz, "America/New_York");
  });

  it("refuses an unknown MIC", async () => {
    await assert.rejects(cal("ZZZZ"), UnknownVenue);
  });
});

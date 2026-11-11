// A venue's trading calendar over a loaded range of dates.
//
// Loaded once by `client.calendar(...)`, then answered from memory: every
// method here is synchronous and makes no request. The names are
// `exchange_calendars`', in camelCase, as diurn-py's and diurn-rs's are.
//
// A *session* is a day the venue trades, as the API's `/v1/trading-days`
// counts one: `open`, `early_close`, `open_for_some`, or a `holiday` that
// carries a session (NSE's Muhurat).
//
// **Nothing is guessed.** A day Diurn cannot answer throws `Indeterminate`,
// never open and never closed; a question that reaches past the loaded range
// throws `OutsideLoaded` (load a wider one); a date that should be a session
// and is not throws `NotASession`.

import { DecodeError, Indeterminate, InvalidArgument, NotASession, OutsideLoaded, UnknownVenue } from "./errors.ts";
import type { DayDto, DayKindDto, TemporalLike, VenueResponse, VerificationDto } from "./generated/models.ts";
import { compareInstants, type DateLike, type InstantLike, toDate, toInstant } from "./temporal.ts";

/** How a calendar is loaded, beyond its venue and range. */
export interface CalendarOptions {
  /** One of the venue's product schedules (see `products`); by default the
   * whole venue's sessions are used. */
  product?: string;
  /** Answer from the dataset Diurn was serving at this instant (Enterprise). */
  asOf?: InstantLike;
}

/** One session: open and close in the venue's zone, its breaks, and the
 * product it is for (`undefined`: the whole venue). */
export interface Session {
  readonly name: string;
  readonly open: Temporal.ZonedDateTime;
  readonly close: Temporal.ZonedDateTime;
  /** Pauses inside it (Hong Kong's lunch), start and end. */
  readonly breaks: readonly (readonly [Temporal.ZonedDateTime, Temporal.ZonedDateTime])[];
  readonly products: string | undefined;
  readonly verification: VerificationDto;
}

/** One day of the calendar. */
export interface Day {
  readonly date: Temporal.PlainDate;
  readonly kind: DayKindDto;
  readonly verification: VerificationDto;
  /** Why it is not an ordinary day (a holiday's name). */
  readonly reason: string | undefined;
  readonly sessions: readonly Session[];
}

/** A day's schedule as `exchange_calendars` lays it out: the first open, the
 * last close, and the first break between them; plus Diurn's `kind`,
 * `verification` and `reason`. Times are `undefined` where Diurn holds no
 * hours for the day. */
export interface ScheduleRow {
  readonly date: Temporal.PlainDate;
  readonly open: Temporal.ZonedDateTime | undefined;
  readonly breakStart: Temporal.ZonedDateTime | undefined;
  readonly breakEnd: Temporal.ZonedDateTime | undefined;
  readonly close: Temporal.ZonedDateTime | undefined;
  readonly kind: DayKindDto;
  readonly verification: VerificationDto;
  readonly reason: string | undefined;
}

/** Whether the venue trades: as `/v1/trading-days` reads a day. */
export function isSessionDay(day: Day): boolean {
  return (
    day.kind === "open" ||
    day.kind === "early_close" ||
    day.kind === "open_for_some" ||
    (day.kind === "holiday" && day.sessions.length > 0)
  );
}

/** One venue's trading calendar over the range of dates it was loaded with. */
export class Calendar {
  /** The venue's MIC: a calendar's name, as `exchange_calendars` names one by its code. */
  readonly name: string;
  /** The venue's name in the ISO 10383 registry. */
  readonly marketName: string;
  /** The IANA zone the venue's sessions are quoted in. */
  readonly tz: string;
  /** The product schedules the venue keeps; empty for almost every one. */
  readonly products: readonly string[];
  /** The product schedule this calendar answers for, if one was chosen. */
  readonly product: string | undefined;
  /** The first and last dates loaded. */
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;
  /** Every day loaded, in order. */
  readonly days: readonly Day[];
  private readonly T: TemporalLike;

  private constructor(
    record: VenueResponse,
    days: Day[],
    from: Temporal.PlainDate,
    to: Temporal.PlainDate,
    product: string | undefined,
    T: TemporalLike,
  ) {
    this.name = record.mic;
    this.marketName = record.name;
    this.tz = record.timezone ?? "UTC";
    this.products = record.products;
    this.product = product;
    this.from = from;
    this.to = to;
    this.days = days;
    this.T = T;
  }

  /** @internal Build a calendar from what `client.calendar` fetched. */
  static assemble(
    record: VenueResponse,
    raw: DayDto[],
    from: Temporal.PlainDate,
    to: Temporal.PlainDate,
    product: string | undefined,
    T: TemporalLike,
  ): Calendar {
    if (!record.timezone || !record.resolution) {
      const body = { error: "no_calendar", message: `no calendar answers ${record.mic}` };
      throw new UnknownVenue(404, "no_calendar", body.message, body);
    }
    if (product !== undefined && !record.products.includes(product)) {
      throw new InvalidArgument(`${record.mic} has no product ${JSON.stringify(product)}; it has ${record.products.join(", ")}`);
    }
    const days: Day[] = raw.map((d) => ({
      date: d.date,
      kind: d.kind,
      verification: d.verification,
      reason: d.reason,
      sessions: d.sessions.map((s) => ({
        name: s.name,
        open: s.open,
        close: s.close,
        breaks: s.breaks.map((b) => [b.start, b.end] as const),
        products: s.products,
        verification: s.verification,
      })),
    }));
    const expected = from.until(to, { largestUnit: "day" }).days + 1;
    if (days.length !== expected || !days[0]?.date.equals(from)) {
      throw new DecodeError(`expected ${expected} days from ${from}, received ${days.length}`);
    }
    return new Calendar(record, days, from, to, product, T);
  }

  // --- days ------------------------------------------------------------------

  /** The day, whatever its kind. */
  day(date: DateLike): Day {
    const d = toDate(date, this.T);
    const index = this.from.until(d, { largestUnit: "day" }).days;
    const found = this.days[index];
    if (index < 0 || !found) throw new OutsideLoaded(d, this.from, this.to);
    return found;
  }

  private known(date: DateLike): Day {
    const day = this.day(date);
    if (day.kind === "unknown") throw new Indeterminate(day.date);
    return day;
  }

  private range(from: DateLike, to: DateLike): Day[] {
    const a = this.day(from);
    const b = this.day(to);
    const start = this.from.until(a.date, { largestUnit: "day" }).days;
    const end = this.from.until(b.date, { largestUnit: "day" }).days;
    return end < start ? [] : this.days.slice(start, end + 1);
  }

  // --- the exchange_calendars interface -----------------------------------------

  /** Whether the venue trades on the date. */
  isSession(date: DateLike): boolean {
    return isSessionDay(this.known(date));
  }

  /** The sessions from `from` to `to`, inclusive. */
  sessionsInRange(from: DateLike, to: DateLike): Temporal.PlainDate[] {
    const out: Temporal.PlainDate[] = [];
    for (const day of this.range(from, to)) {
      if (day.kind === "unknown") throw new Indeterminate(day.date);
      if (isSessionDay(day)) out.push(day.date);
    }
    return out;
  }

  /** The first session after `date`, which need not be a session itself. */
  nextSession(date: DateLike): Temporal.PlainDate {
    return this.step(toDate(date, this.T), 1);
  }

  /** The last session before `date`, which need not be a session itself. */
  previousSession(date: DateLike): Temporal.PlainDate {
    return this.step(toDate(date, this.T), -1);
  }

  private step(start: Temporal.PlainDate, direction: 1 | -1): Temporal.PlainDate {
    for (let d = start.add({ days: direction }); ; d = d.add({ days: direction })) {
      if (isSessionDay(this.known(d))) return d;
    }
  }

  /** `date` if it is a session; otherwise the next or previous one, or with
   * `"none"`, `NotASession`. */
  dateToSession(date: DateLike, direction: "none" | "next" | "previous" = "none"): Temporal.PlainDate {
    const d = toDate(date, this.T);
    if (this.isSession(d)) return d;
    if (direction === "next") return this.nextSession(d);
    if (direction === "previous") return this.previousSession(d);
    throw new NotASession(d);
  }

  /** `|count|` sessions from `session`: forwards for a positive count,
   * backwards and ending at `session` for a negative one. */
  sessionsWindow(session: DateLike, count: number): Temporal.PlainDate[] {
    const d = toDate(session, this.T);
    if (!this.isSession(d)) throw new NotASession(d);
    if (count === 0 || !Number.isInteger(count)) throw new InvalidArgument("count is a non-zero integer");
    const out = [d];
    while (out.length < Math.abs(count)) out.push(this.step(out[out.length - 1] as Temporal.PlainDate, count > 0 ? 1 : -1));
    return count > 0 ? out : out.reverse();
  }

  /** The number of sessions from `start` to `end`, both included; negative
   * when `end` is before `start`. A range with an unknown day throws
   * `Indeterminate`: a count that skipped it would be wrong. */
  sessionsDistance(start: DateLike, end: DateLike): number {
    const a = toDate(start, this.T);
    const b = toDate(end, this.T);
    const forward = this.T.PlainDate.compare(a, b) <= 0;
    const count = this.sessionsInRange(forward ? a : b, forward ? b : a).length;
    return forward ? count : -count;
  }

  /** Whether a session is running at the instant, outside its breaks. */
  isOpenAtTime(at: InstantLike): boolean {
    const t = toInstant(at, this.T);
    const local = t.toZonedDateTimeISO(this.tz).toPlainDate();
    this.known(local);
    for (const date of [local.subtract({ days: 1 }), local, local.add({ days: 1 })]) {
      let day: Day;
      try {
        day = this.day(date);
      } catch {
        continue;
      }
      for (const s of this.sessions(day)) {
        const inside = compareInstants(s.open, t) <= 0 && compareInstants(t, s.close) < 0;
        const paused = s.breaks.some(([b0, b1]) => compareInstants(b0, t) <= 0 && compareInstants(t, b1) < 0);
        if (inside && !paused) return true;
      }
    }
    return false;
  }

  /** The first session open after the instant. */
  nextOpen(after: InstantLike): Temporal.ZonedDateTime {
    return this.nextEdge(toInstant(after, this.T), "open");
  }

  /** The first session close after the instant. */
  nextClose(after: InstantLike): Temporal.ZonedDateTime {
    return this.nextEdge(toInstant(after, this.T), "close");
  }

  private nextEdge(after: Temporal.Instant, edge: "open" | "close"): Temporal.ZonedDateTime {
    const local = after.toZonedDateTimeISO(this.tz).toPlainDate();
    // A session can open the evening before its date (a night session).
    let d = local.subtract({ days: 1 });
    if (this.T.PlainDate.compare(d, this.from) < 0) d = this.from;
    for (; ; d = d.add({ days: 1 })) {
      const day = this.day(d);
      if (day.kind === "unknown" && this.T.PlainDate.compare(d, local) >= 0) throw new Indeterminate(d);
      const found = this.sessions(day)
        .map((s) => s[edge])
        .sort(compareInstants)
        .find((x) => compareInstants(x, after) > 0);
      if (found) return found;
    }
  }

  // --- one session's times -----------------------------------------------------

  /** The session's first open; `undefined` where Diurn holds no hours for it. */
  sessionOpen(session: DateLike): Temporal.ZonedDateTime | undefined {
    return this.sessionRow(session).open;
  }

  /** The session's last close. */
  sessionClose(session: DateLike): Temporal.ZonedDateTime | undefined {
    return this.sessionRow(session).close;
  }

  /** The start of the session's break (Tokyo's lunch); `undefined` without one. */
  sessionBreakStart(session: DateLike): Temporal.ZonedDateTime | undefined {
    return this.sessionRow(session).breakStart;
  }

  /** The end of the session's break. */
  sessionBreakEnd(session: DateLike): Temporal.ZonedDateTime | undefined {
    return this.sessionRow(session).breakEnd;
  }

  private sessionRow(date: DateLike): ScheduleRow {
    const day = this.known(date);
    if (!isSessionDay(day)) throw new NotASession(day.date);
    return this.row(day);
  }

  /** One row per session from `from` to `to`; with `allDays`, one per day, so
   * holidays and unknown days appear with their kind and no times. */
  schedule(from: DateLike, to: DateLike, options: { allDays?: boolean } = {}): ScheduleRow[] {
    const out: ScheduleRow[] = [];
    for (const day of this.range(from, to)) {
      if (!options.allDays) {
        if (day.kind === "unknown") throw new Indeterminate(day.date);
        if (!isSessionDay(day)) continue;
      }
      out.push(this.row(day));
    }
    return out;
  }

  // --- internals -----------------------------------------------------------------

  /** The day's sessions for this calendar: the chosen product's (and the
   * venue's), or the venue's, or, where every session is scoped to a product,
   * all of them. */
  private sessions(day: Day): Session[] {
    if (this.product !== undefined) {
      return day.sessions.filter((s) => s.products === undefined || s.products === this.product);
    }
    const whole = day.sessions.filter((s) => s.products === undefined);
    return whole.length > 0 ? whole : [...day.sessions];
  }

  private row(day: Day): ScheduleRow {
    const sessions = this.sessions(day).sort((a, b) => compareInstants(a.open, b.open));
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    let gap: readonly [Temporal.ZonedDateTime, Temporal.ZonedDateTime] | undefined;
    if (first && sessions.length > 1) gap = [first.close, (sessions[1] as Session).open];
    else if (first) gap = first.breaks[0];
    return {
      date: day.date,
      open: first?.open,
      breakStart: gap?.[0],
      breakEnd: gap?.[1],
      close: last?.close,
      kind: day.kind,
      verification: day.verification,
      reason: day.reason,
    };
  }
}

// The API, one method per operation, returning its shapes as typed values.

import { Calendar, type CalendarOptions } from "./calendar.ts";
import { InvalidArgument, InvalidMic } from "./errors.ts";
import * as m from "./generated/models.ts";
import { type DateLike, type InstantLike, resolveTemporal, toDate, toInstant } from "./temporal.ts";
import { type ClientOptions, type Param, type Request, Transport } from "./transport.ts";

/** Only answer from the dataset Diurn was serving at this instant (Enterprise). */
export interface AsOf {
  asOf?: InstantLike;
}

/** Filters for {@link Client.venues}; everything by default. */
export interface VenuesQuery {
  /** Case-insensitive match on MIC, operating MIC, name or acronym. */
  q?: string;
  /** ISO 3166-1 alpha-2. */
  country?: string;
  /** `own`, `operating_mic`, `country` or `none`. */
  resolution?: string[];
  /** Registry statuses (`active`, `updated`, `expired`) or `all`; `active` by default. */
  status?: string[];
  /** At most 1,000; 100 by default. */
  limit?: number;
  /** `nextCursor` from the previous page. */
  cursor?: string;
}

export interface SessionsOptions extends AsOf {
  /** Only days of these kinds; all days when absent. */
  kinds?: m.DayKindDto[];
  /** The evidence behind each day, on plans that include it. */
  provenance?: boolean;
}

export interface StatusOptions extends AsOf {
  /** The instant asked about; now by default. */
  at?: InstantLike;
}

export interface ExceptionsOptions extends AsOf {
  /** The kinds wanted; by default `holiday`, `early_close`, `open_for_some`, `unknown`. */
  kinds?: m.DayKindDto[];
}

export interface StepOptions extends AsOf {
  /** Trading days to move; 1 by default, at most 366. */
  n?: number;
  /** Count the starting date itself when it trades. */
  inclusive?: boolean;
  /** Reaching an unknown day: `error` (default, throws `Indeterminate`) or `skip`. */
  onUnknown?: "error" | "skip";
}

export interface JointOptions extends StepOptions {
  /** `all` (default): every venue trades; `any`: at least one does. */
  mode?: "all" | "any";
}

/** A MIC, checked and upper-cased before any request. */
export function mic(code: string): string {
  const out = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(out)) throw new InvalidMic(code);
  return out;
}

function mics(codes: Iterable<string>): string[] {
  const out = [...codes].map(mic);
  if (out.length === 0) throw new InvalidArgument("no venues given");
  return out;
}

/**
 * A connection to the Diurn API.
 *
 * ```ts
 * const client = new Client(); // DIURN_API_KEY, DIURN_API_URL
 * const now = await client.statuses(["XNYS", "XLON", "XTKS"]);
 * ```
 *
 * Every endpoint but the registry record, `health` and the venue list needs a
 * key; a free one is at https://diurn.io/signin/.
 *
 * **Retries** are off by default. With `retries`, a client retries what
 * waiting can fix: a rate limit, after the server's `Retry-After`; a 503 or a
 * failed connection, backing off from half a second. A plan's refusal (a MIC
 * cap, a date outside the window) is never retried, and a wait longer than
 * `maxWaitMs` is thrown rather than slept.
 */
export class Client {
  private readonly transport: Transport;
  /** The `Temporal` this client builds its dates and instants with: the
   * runtime's, or the one it was given. */
  readonly temporal: m.TemporalLike;

  constructor(options: ClientOptions = {}) {
    this.temporal = resolveTemporal(options.temporal);
    this.transport = new Transport(options, this.temporal);
  }

  /** The headers of the last response, lower-cased: the usage headers
   * (`diurn-mics-day`, `ratelimit-remaining`, ...) and `x-diurn-dataset`. */
  get lastHeaders(): Record<string, string> {
    return { ...this.transport.lastHeaders };
  }

  private date(value: DateLike): string {
    return toDate(value, this.temporal).toString();
  }

  private instant(value: InstantLike | undefined): string | undefined {
    return value === undefined ? undefined : toInstant(value, this.temporal).toString();
  }

  private async call<R>(request: Request, decode: (raw: unknown, T: m.TemporalLike) => R): Promise<R> {
    return decode(await this.transport.get(request), this.temporal);
  }

  // --- free ----------------------------------------------------------------

  /** Liveness, and which dataset the server is serving. Free. */
  async health(): Promise<m.Health> {
    return this.call({ path: "/health" }, m.decodeHealth);
  }

  /** The ISO 10383 record, with the venue's zone, how it is answered, and its
   * product schedules. Free and unmetered. */
  async venue(code: string): Promise<m.VenueResponse> {
    return this.call({ path: `/v1/venues/${mic(code)}` }, m.decodeVenueResponse);
  }

  /** List and search venues, a page at a time. Free and unmetered. */
  async venues(query: VenuesQuery = {}): Promise<m.VenuesResponse> {
    const params: Record<string, Param> = { ...query };
    return this.call({ path: "/v1/venues", params }, m.decodeVenuesResponse);
  }

  /** Your usage against your plan. Needs a key; never metered. */
  async usage(): Promise<m.UsageView> {
    return this.call({ path: "/v1/usage" }, m.decodeUsageView);
  }

  // --- one venue -------------------------------------------------------------

  /** Every day from `from` to `to`, inclusive, with its sessions. */
  async sessions(code: string, from: DateLike, to: DateLike, options: SessionsOptions = {}): Promise<m.DaysResponse> {
    const params = {
      from: this.date(from),
      to: this.date(to),
      kinds: options.kinds,
      expand: options.provenance ? "provenance" : undefined,
      as_of: this.instant(options.asOf),
    };
    return this.call({ path: `/v1/venues/${mic(code)}/sessions`, params }, m.decodeDaysResponse);
  }

  /** One day, with its provenance in full on plans that include it. */
  async day(code: string, date: DateLike, options: AsOf = {}): Promise<m.DayResponse> {
    const path = `/v1/venues/${mic(code)}/days/${this.date(date)}`;
    return this.call({ path, params: { as_of: this.instant(options.asOf) } }, m.decodeDayResponse);
  }

  /** Whether the venue is trading at an instant (now, unless `at` is given). */
  async status(code: string, options: StatusOptions = {}): Promise<m.StatusResponse> {
    const at = this.instant(options.at) ?? this.temporal.Now.instant().toString();
    const params = { at, as_of: this.instant(options.asOf) };
    return this.call({ path: `/v1/venues/${mic(code)}/status`, params }, m.decodeStatusResponse);
  }

  /** The next instant the venue starts trading, after `from`. */
  async nextOpen(code: string, from: InstantLike, options: AsOf = {}): Promise<m.InstantResponse> {
    return this.edge(code, "next-open", from, options);
  }

  /** The next instant the venue stops trading, after `from`. */
  async nextClose(code: string, from: InstantLike, options: AsOf = {}): Promise<m.InstantResponse> {
    return this.edge(code, "next-close", from, options);
  }

  private async edge(code: string, which: string, from: InstantLike, options: AsOf): Promise<m.InstantResponse> {
    const params = { from: this.instant(from), as_of: this.instant(options.asOf) };
    return this.call({ path: `/v1/venues/${mic(code)}/${which}`, params }, m.decodeInstantResponse);
  }

  /** The `n`th trading day after `from`, with the closures passed over. */
  async nextTradingDay(code: string, from: DateLike, options: StepOptions = {}): Promise<m.StepResponse> {
    return this.step(code, "next", from, options);
  }

  /** The `n`th trading day before `from`. */
  async previousTradingDay(code: string, from: DateLike, options: StepOptions = {}): Promise<m.StepResponse> {
    return this.step(code, "previous", from, options);
  }

  private async step(code: string, direction: string, from: DateLike, o: StepOptions): Promise<m.StepResponse> {
    const path = `/v1/venues/${mic(code)}/trading-days/${direction}`;
    return this.call({ path, params: this.stepParams(from, o) }, m.decodeStepResponse);
  }

  /** The server's defaults (`inclusive=false`, `on_unknown=error`, `mode=all`)
   * are left out of a request rather than spelled. */
  private stepParams(from: DateLike, o: JointOptions): Record<string, Param> {
    return {
      from: this.date(from),
      n: o.n,
      mode: o.mode === "any" ? "any" : undefined,
      inclusive: o.inclusive ? true : undefined,
      on_unknown: o.onUnknown === "skip" ? "skip" : undefined,
      as_of: this.instant(o.asOf),
    };
  }

  /** Trading days from `from` to `to`, inclusive; a lower bound where
   * `unknown` is above zero. */
  async countTradingDays(code: string, from: DateLike, to: DateLike, options: AsOf = {}): Promise<m.CountResponse> {
    const params = { from: this.date(from), to: this.date(to), as_of: this.instant(options.asOf) };
    return this.call({ path: `/v1/venues/${mic(code)}/trading-days/count`, params }, m.decodeCountResponse);
  }

  // --- many venues -------------------------------------------------------------

  /** Whether several venues are trading at an instant (now, unless `at` is given). */
  async statuses(codes: Iterable<string>, options: StatusOptions = {}): Promise<m.StatusesResponse> {
    const params = { mics: mics(codes), at: this.instant(options.at), as_of: this.instant(options.asOf) };
    return this.call({ path: "/v1/status", params, many: true }, m.decodeStatusesResponse);
  }

  /** Holidays and irregular days across venues, one row each, by date then MIC. */
  async exceptions(
    codes: Iterable<string>,
    from: DateLike,
    to: DateLike,
    options: ExceptionsOptions = {},
  ): Promise<m.ExceptionsResponse> {
    const params = {
      mics: mics(codes),
      from: this.date(from),
      to: this.date(to),
      kinds: options.kinds,
      as_of: this.instant(options.asOf),
    };
    return this.call({ path: "/v1/exceptions", params, many: true }, m.decodeExceptionsResponse);
  }

  /** Many venues over a range, column-oriented. */
  async sessionsBulk(codes: Iterable<string>, from: DateLike, to: DateLike, options: AsOf = {}): Promise<m.BulkResponse> {
    const params = { mics: mics(codes), from: this.date(from), to: this.date(to), as_of: this.instant(options.asOf) };
    return this.call({ path: "/v1/sessions", params, many: true }, m.decodeBulkResponse);
  }

  /** A date-and-boolean series per venue; `null` where it cannot say. */
  async tradingDays(
    codes: Iterable<string>,
    from: DateLike,
    to: DateLike,
    options: AsOf = {},
  ): Promise<m.TradingDaysResponse> {
    const params = { mics: mics(codes), from: this.date(from), to: this.date(to), as_of: this.instant(options.asOf) };
    return this.call({ path: "/v1/trading-days", params, many: true }, m.decodeTradingDaysResponse);
  }

  /** The `n`th date after `from` on which all (or any) of the venues trade. */
  async jointNextTradingDay(codes: Iterable<string>, from: DateLike, options: JointOptions = {}): Promise<m.JointStepResponse> {
    return this.joint(codes, "next", from, options);
  }

  /** The `n`th date before `from` on which all (or any) of the venues trade. */
  async jointPreviousTradingDay(
    codes: Iterable<string>,
    from: DateLike,
    options: JointOptions = {},
  ): Promise<m.JointStepResponse> {
    return this.joint(codes, "previous", from, options);
  }

  private async joint(codes: Iterable<string>, direction: string, from: DateLike, o: JointOptions): Promise<m.JointStepResponse> {
    const params = { mics: mics(codes), ...this.stepParams(from, o) };
    return this.call({ path: `/v1/trading-days/${direction}`, params, many: true }, m.decodeJointStepResponse);
  }

  // --- the calendar --------------------------------------------------------------

  /**
   * A venue's calendar from `from` to `to`, loaded once: one call for the
   * venue's record and one per 1,830 days of sessions. Every question a
   * {@link Calendar} answers is then answered from what was loaded, without
   * another request.
   */
  async calendar(code: string, from: DateLike, to: DateLike, options: CalendarOptions = {}): Promise<Calendar> {
    const T = this.temporal;
    const record = await this.venue(code);
    const start = toDate(from, T);
    const end = toDate(to, T);
    if (T.PlainDate.compare(end, start) < 0) throw new InvalidArgument(`${end} is before ${start}`);
    const days: m.DayDto[] = [];
    for (let a = start; T.PlainDate.compare(a, end) <= 0; ) {
      let b = a.add({ days: 1829 });
      if (T.PlainDate.compare(b, end) > 0) b = end;
      const chunk = await this.sessions(record.mic, a, b, { asOf: options.asOf });
      days.push(...chunk.days);
      a = b.add({ days: 1 });
    }
    return Calendar.assemble(record, days, start, end, options.product, T);
  }
}

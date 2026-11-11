// Generated from openapi.json by scripts/generate.mjs. Do not edit.
//
// The API's shapes, one per schema, with a decoder each that turns the
// server's JSON into them: camelCase fields, `Temporal` dates and instants.

/* eslint-disable */

/** The `Temporal` implementation decoders build values with. */
export type TemporalLike = typeof Temporal;

export type DayKindDto = "open" | "weekend" | "holiday" | "early_close" | "open_for_some" | "unknown";

export type OverLimitError = "not_in_plan" | "out_of_window" | "mic_cap_exceeded" | "rate_limited";

export type OverLimitLimitKind = "mics_day" | "mics_month" | "rate";

/**
 * Whether the venue is trading **at an instant** — the intraday axis.
 */
export type StateDto = "running" | "closed" | "unknown";

/**
 * How much to trust a served day. Always present.
 */
export type VerificationDto = "verified" | "corroborated" | "inferreddefinitional" | "inferredpredictive" | "inferredadvisory";

/**
 * Typed, because SPEC: client-shared-surface requires every client to
 * distinguish auth failure from an unknown calendar from an out-of-range
 * query, and it cannot if the server returns prose.
 */
export interface ApiError {
  /**
   * A stable machine-readable tag. Clients switch on this, never on prose.
   */
  readonly error: string;
  readonly message: string;
}

/** Decode the server's JSON for a {@link ApiError}. */
export function decodeApiError(r: any, T: TemporalLike): ApiError {
  return {
    error: r["error"],
    message: r["message"],
  };
}

export interface BreakDto {
  readonly end: Temporal.ZonedDateTime;
  readonly start: Temporal.ZonedDateTime;
}

/** Decode the server's JSON for a {@link BreakDto}. */
export function decodeBreakDto(r: any, T: TemporalLike): BreakDto {
  return {
    end: T.ZonedDateTime.from(r["end"]),
    start: T.ZonedDateTime.from(r["start"]),
  };
}

export interface BulkBody {
  /**
   * RFC 3339. Answer from the dataset Diurn was serving at that instant
   * (Enterprise).
   */
  readonly asOf?: Temporal.Instant;
  readonly from: Temporal.PlainDate;
  readonly mics: string[];
  readonly to: Temporal.PlainDate;
}

/** Decode the server's JSON for a {@link BulkBody}. */
export function decodeBulkBody(r: any, T: TemporalLike): BulkBody {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    from: T.PlainDate.from(r["from"]),
    mics: r["mics"] == null ? [] : [...r["mics"]],
    to: T.PlainDate.from(r["to"]),
  };
}

export interface BulkCalendar {
  /**
   * One character per date, in the order of `dates`.
   */
  readonly kinds: string;
  /**
   * Likewise. Present on every row: it is the cheap half of provenance and
   * the half that decides whether to trust the cell (SPEC: provenance-is-stored-not-shipped).
   */
  readonly verification: string;
}

/** Decode the server's JSON for a {@link BulkCalendar}. */
export function decodeBulkCalendar(r: any, T: TemporalLike): BulkCalendar {
  return {
    kinds: r["kinds"],
    verification: r["verification"],
  };
}

/**
 * Column-oriented: the dates once, then one short code per day per calendar.
 */
export interface BulkResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  readonly dataset?: DatasetServed;
  readonly dates: Temporal.PlainDate[];
  readonly from: Temporal.PlainDate;
  readonly legend: Legend;
  readonly to: Temporal.PlainDate;
  /**
   * One series per requested MIC, keyed by the MIC.
   */
  readonly venues: Record<string, BulkCalendar>;
}

/** Decode the server's JSON for a {@link BulkResponse}. */
export function decodeBulkResponse(r: any, T: TemporalLike): BulkResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    dates: r["dates"].map((x: any) => T.PlainDate.from(x)),
    from: T.PlainDate.from(r["from"]),
    legend: decodeLegend(r["legend"], T),
    to: T.PlainDate.from(r["to"]),
    venues: Object.fromEntries(Object.entries(r["venues"]).map(([k, x]: [string, any]) => [k, decodeBulkCalendar(x, T)])),
  };
}

export interface CountResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  /**
   * Trading days in the range, inclusive. **A lower bound when `unknown`
   * is above zero**: those days may trade.
   */
  readonly count: number;
  readonly dataset?: DatasetServed;
  readonly from: Temporal.PlainDate;
  readonly mic: string;
  readonly to: Temporal.PlainDate;
  /**
   * Days in the range the engine cannot answer.
   */
  readonly unknown: number;
}

/** Decode the server's JSON for a {@link CountResponse}. */
export function decodeCountResponse(r: any, T: TemporalLike): CountResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    count: r["count"],
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    from: T.PlainDate.from(r["from"]),
    mic: r["mic"],
    to: T.PlainDate.from(r["to"]),
    unknown: r["unknown"],
  };
}

/**
 * The dataset that answered an `as_of` request (SPEC-pricing §5.1).
 */
export interface DatasetServed {
  /**
   * First twelve hex of the dataset's content id: what `/health` calls
   * `dataset`, and the same for every build of the same data.
   */
  readonly id: string;
  /**
   * True for a model rebuilt after the fact rather than served at the
   * time. Nothing is rebuilt yet, so this is false.
   */
  readonly reconstructed: boolean;
  /**
   * When Diurn began serving it.
   */
  readonly servedFrom: Temporal.Instant;
  /**
   * When the next dataset replaced it; null while it is still served.
   */
  readonly servedUntil?: Temporal.Instant;
}

/** Decode the server's JSON for a {@link DatasetServed}. */
export function decodeDatasetServed(r: any, T: TemporalLike): DatasetServed {
  return {
    id: r["id"],
    reconstructed: r["reconstructed"],
    servedFrom: T.Instant.from(r["served_from"]),
    servedUntil: r["served_until"] == null ? undefined : T.Instant.from(r["served_until"]),
  };
}

/**
 * The dates the plan may ask about, from today (UTC). Null is unbounded.
 */
export interface DataWindow {
  readonly from?: Temporal.PlainDate;
  readonly to?: Temporal.PlainDate;
}

/** Decode the server's JSON for a {@link DataWindow}. */
export function decodeDataWindow(r: any, T: TemporalLike): DataWindow {
  return {
    from: r["from"] == null ? undefined : T.PlainDate.from(r["from"]),
    to: r["to"] == null ? undefined : T.PlainDate.from(r["to"]),
  };
}

export interface DayDto {
  readonly date: Temporal.PlainDate;
  readonly kind: DayKindDto;
  readonly products?: ProductSplitDto;
  readonly provenance?: Provenance;
  readonly reason?: string;
  readonly sessions: SessionDto[];
  readonly verification: VerificationDto;
}

/** Decode the server's JSON for a {@link DayDto}. */
export function decodeDayDto(r: any, T: TemporalLike): DayDto {
  return {
    date: T.PlainDate.from(r["date"]),
    kind: r["kind"],
    products: r["products"] == null ? undefined : decodeProductSplitDto(r["products"], T),
    provenance: r["provenance"] == null ? undefined : decodeProvenance(r["provenance"], T),
    reason: r["reason"] == null ? undefined : r["reason"],
    sessions: r["sessions"] == null ? [] : r["sessions"].map((x: any) => decodeSessionDto(x, T)),
    verification: r["verification"],
  };
}

/**
 * One day, and with `as_of`, which dataset answered.
 */
export interface DayResponse {
  readonly date: Temporal.PlainDate;
  readonly kind: DayKindDto;
  readonly products?: ProductSplitDto;
  readonly provenance?: Provenance;
  readonly reason?: string;
  readonly sessions: SessionDto[];
  readonly verification: VerificationDto;
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  readonly dataset?: DatasetServed;
}

/** Decode the server's JSON for a {@link DayResponse}. */
export function decodeDayResponse(r: any, T: TemporalLike): DayResponse {
  return {
    date: T.PlainDate.from(r["date"]),
    kind: r["kind"],
    products: r["products"] == null ? undefined : decodeProductSplitDto(r["products"], T),
    provenance: r["provenance"] == null ? undefined : decodeProvenance(r["provenance"], T),
    reason: r["reason"] == null ? undefined : r["reason"],
    sessions: r["sessions"] == null ? [] : r["sessions"].map((x: any) => decodeSessionDto(x, T)),
    verification: r["verification"],
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
  };
}

export interface DaysResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  readonly dataset?: DatasetServed;
  readonly days: DayDto[];
  readonly mic?: string;
}

/** Decode the server's JSON for a {@link DaysResponse}. */
export function decodeDaysResponse(r: any, T: TemporalLike): DaysResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    days: r["days"].map((x: any) => decodeDayDto(x, T)),
    mic: r["mic"] == null ? undefined : r["mic"],
  };
}

export interface ExceptionsBody {
  /**
   * RFC 3339. Answer from the dataset Diurn was serving at that instant
   * (Enterprise).
   */
  readonly asOf?: Temporal.Instant;
  readonly from: Temporal.PlainDate;
  /**
   * Day kinds. Default `holiday`, `early_close`, `open_for_some`,
   * `unknown`.
   */
  readonly kinds: string[];
  readonly mics: string[];
  readonly to: Temporal.PlainDate;
}

/** Decode the server's JSON for a {@link ExceptionsBody}. */
export function decodeExceptionsBody(r: any, T: TemporalLike): ExceptionsBody {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    from: T.PlainDate.from(r["from"]),
    kinds: r["kinds"] == null ? [] : [...r["kinds"]],
    mics: r["mics"] == null ? [] : [...r["mics"]],
    to: T.PlainDate.from(r["to"]),
  };
}

export interface ExceptionsResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  readonly dataset?: DatasetServed;
  /**
   * The days of the kinds asked for, by date and then MIC. No provenance:
   * ask for the day itself.
   */
  readonly days: VenueDay[];
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;
}

/** Decode the server's JSON for a {@link ExceptionsResponse}. */
export function decodeExceptionsResponse(r: any, T: TemporalLike): ExceptionsResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    days: r["days"].map((x: any) => decodeVenueDay(x, T)),
    from: T.PlainDate.from(r["from"]),
    to: T.PlainDate.from(r["to"]),
  };
}

export interface Health {
  /**
   * First twelve hex of the served artifact's SHA-256, or `"built-in"` for
   * the copy baked into the image.
   */
  readonly artifact: string;
  readonly builtAt: Temporal.Instant;
  /**
   * First twelve hex of the served dataset's content id: what its data
   * says, without when it was built. The same for every build of the same
   * data, which `artifact` is not, and the name the point-in-time archive
   * uses (SPEC: point-in-time-archive).
   */
  readonly dataset: string;
  /**
   * How many MICs this process can answer for by explicit mapping.
   */
  readonly mappedVenues: number;
  /**
   * Publication date of the ISO vintage this process is serving.
   */
  readonly registryPublished: Temporal.PlainDate;
  readonly status: string;
}

/** Decode the server's JSON for a {@link Health}. */
export function decodeHealth(r: any, T: TemporalLike): Health {
  return {
    artifact: r["artifact"],
    builtAt: T.Instant.from(r["built_at"]),
    dataset: r["dataset"],
    mappedVenues: r["mapped_venues"],
    registryPublished: T.PlainDate.from(r["registry_published"]),
    status: r["status"],
  };
}

export interface InstantResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  /**
   * `null` when the engine cannot say — past an anchor's range, beyond the
   * scan horizon, or on a calendar that publishes no hours at all, as
   * `US-FUTURES-ICE` does. Not the same as "never".
   */
  readonly at?: Temporal.ZonedDateTime;
  readonly dataset?: DatasetServed;
  readonly from: Temporal.Instant;
  readonly mic?: string;
}

/** Decode the server's JSON for a {@link InstantResponse}. */
export function decodeInstantResponse(r: any, T: TemporalLike): InstantResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    at: r["at"] == null ? undefined : T.ZonedDateTime.from(r["at"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    from: T.Instant.from(r["from"]),
    mic: r["mic"] == null ? undefined : r["mic"],
  };
}

/**
 * A date passed over: the venues that did not trade it, other than for a
 * weekend.
 */
export interface JointSkipped {
  readonly closed: Record<string, SkippedDay>;
  readonly date: Temporal.PlainDate;
}

/** Decode the server's JSON for a {@link JointSkipped}. */
export function decodeJointSkipped(r: any, T: TemporalLike): JointSkipped {
  return {
    closed: Object.fromEntries(Object.entries(r["closed"]).map(([k, x]: [string, any]) => [k, decodeSkippedDay(x, T)])),
    date: T.PlainDate.from(r["date"]),
  };
}

export interface JointStepBody {
  /**
   * RFC 3339. Answer from the dataset Diurn was serving at that instant
   * (Enterprise).
   */
  readonly asOf?: Temporal.Instant;
  readonly from: Temporal.PlainDate;
  readonly inclusive?: boolean;
  readonly mics: string[];
  /**
   * `all` (default) or `any`.
   */
  readonly mode?: string;
  readonly n?: number;
  readonly onUnknown?: string;
}

/** Decode the server's JSON for a {@link JointStepBody}. */
export function decodeJointStepBody(r: any, T: TemporalLike): JointStepBody {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    from: T.PlainDate.from(r["from"]),
    inclusive: r["inclusive"] == null ? undefined : r["inclusive"],
    mics: r["mics"] == null ? [] : [...r["mics"]],
    mode: r["mode"] == null ? undefined : r["mode"],
    n: r["n"] == null ? undefined : r["n"],
    onUnknown: r["on_unknown"] == null ? undefined : r["on_unknown"],
  };
}

export interface JointStepResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  readonly dataset?: DatasetServed;
  /**
   * The date reached.
   */
  readonly date: Temporal.PlainDate;
  readonly from: Temporal.PlainDate;
  readonly mics: string[];
  /**
   * `all` or `any`.
   */
  readonly mode: string;
  readonly n: number;
  /**
   * Dates passed over on which some venue was closed other than for a
   * weekend.
   */
  readonly skipped: JointSkipped[];
  /**
   * With `on_unknown=skip`: dates passed over uncounted because the answer
   * for them is unknown.
   */
  readonly unknownSkipped: Temporal.PlainDate[];
  /**
   * Each venue's kind of day on `date`.
   */
  readonly venues: Record<string, DayKindDto>;
}

/** Decode the server's JSON for a {@link JointStepResponse}. */
export function decodeJointStepResponse(r: any, T: TemporalLike): JointStepResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    date: T.PlainDate.from(r["date"]),
    from: T.PlainDate.from(r["from"]),
    mics: [...r["mics"]],
    mode: r["mode"],
    n: r["n"],
    skipped: r["skipped"].map((x: any) => decodeJointSkipped(x, T)),
    unknownSkipped: r["unknown_skipped"] == null ? [] : r["unknown_skipped"].map((x: any) => T.PlainDate.from(x)),
    venues: { ...r["venues"] },
  };
}

export interface Legend {
  readonly kinds: Record<string, string>;
  readonly verification: Record<string, string>;
}

/** Decode the server's JSON for a {@link Legend}. */
export function decodeLegend(r: any, T: TemporalLike): Legend {
  return {
    kinds: { ...r["kinds"] },
    verification: { ...r["verification"] },
  };
}

/**
 * One MIC cap's count (SPEC-pricing §6.4). `max` is null on a plan with
 * every MIC.
 */
export interface MicWindow {
  readonly max?: number;
  /**
   * The MICs in the window: listed for the 24-hour one, so a caller can
   * see what holds their slots.
   */
  readonly mics?: string[];
  /**
   * When the oldest MIC in the window leaves it, freeing a slot.
   */
  readonly resetsAt?: Temporal.Instant;
  readonly used: number;
  /**
   * `rolling_24h` or `rolling_30d`.
   */
  readonly window: string;
}

/** Decode the server's JSON for a {@link MicWindow}. */
export function decodeMicWindow(r: any, T: TemporalLike): MicWindow {
  return {
    max: r["max"] == null ? undefined : r["max"],
    mics: r["mics"] == null ? undefined : [...r["mics"]],
    resetsAt: r["resets_at"] == null ? undefined : T.Instant.from(r["resets_at"]),
    used: r["used"],
    window: r["window"],
  };
}

export interface OverLimit {
  /**
   * For `out_of_window`: the dates the plan may ask about; null is unbounded
   */
  readonly allowed?: OverLimitAllowed;
  readonly error: OverLimitError;
  readonly limit?: OverLimitLimit;
  readonly message: string;
  /**
   * The MICs holding the window's slots
   */
  readonly micsInUse: string[];
  /**
   * When a slot frees, the budget renews, or the rate allows another request
   */
  readonly resetsAt?: Temporal.Instant;
  readonly upgrade?: string;
}

/** Decode the server's JSON for a {@link OverLimit}. */
export function decodeOverLimit(r: any, T: TemporalLike): OverLimit {
  return {
    allowed: r["allowed"] == null ? undefined : decodeOverLimitAllowed(r["allowed"], T),
    error: r["error"],
    limit: r["limit"] == null ? undefined : decodeOverLimitLimit(r["limit"], T),
    message: r["message"],
    micsInUse: r["mics_in_use"] == null ? [] : [...r["mics_in_use"]],
    resetsAt: r["resets_at"] == null ? undefined : T.Instant.from(r["resets_at"]),
    upgrade: r["upgrade"] == null ? undefined : r["upgrade"],
  };
}

/**
 * For `out_of_window`: the dates the plan may ask about; null is unbounded
 */
export interface OverLimitAllowed {
  readonly from?: Temporal.PlainDate;
  readonly to?: Temporal.PlainDate;
}

/** Decode the server's JSON for a {@link OverLimitAllowed}. */
export function decodeOverLimitAllowed(r: any, T: TemporalLike): OverLimitAllowed {
  return {
    from: r["from"] == null ? undefined : T.PlainDate.from(r["from"]),
    to: r["to"] == null ? undefined : T.PlainDate.from(r["to"]),
  };
}

export interface OverLimitLimit {
  readonly kind?: OverLimitLimitKind;
  readonly max?: number;
  readonly used?: number;
}

/** Decode the server's JSON for a {@link OverLimitLimit}. */
export function decodeOverLimitLimit(r: any, T: TemporalLike): OverLimitLimit {
  return {
    kind: r["kind"] == null ? undefined : r["kind"],
    max: r["max"] == null ? undefined : r["max"],
    used: r["used"] == null ? undefined : r["used"],
  };
}

/**
 * Which products traded on a day that did not treat them alike.
 */
export interface ProductSplitDto {
  readonly closed: string[];
  /**
   * What the lists cannot carry — a venue saying some hours will be
   * announced later, which leaves a group open and its hours unknown.
   */
  readonly note?: string;
  readonly open: string[];
}

/** Decode the server's JSON for a {@link ProductSplitDto}. */
export function decodeProductSplitDto(r: any, T: TemporalLike): ProductSplitDto {
  return {
    closed: r["closed"] == null ? [] : [...r["closed"]],
    note: r["note"] == null ? undefined : r["note"],
    open: r["open"] == null ? [] : [...r["open"]],
  };
}

/**
 * The evidence behind a day. Only ever sent when asked for.
 */
export interface Provenance {
  readonly retrieved?: Temporal.PlainDate;
  readonly source?: string;
}

/** Decode the server's JSON for a {@link Provenance}. */
export function decodeProvenance(r: any, T: TemporalLike): Provenance {
  return {
    retrieved: r["retrieved"] == null ? undefined : T.PlainDate.from(r["retrieved"]),
    source: r["source"] == null ? undefined : r["source"],
  };
}

export interface Rate {
  /**
   * The multi-venue endpoints' own rate.
   */
  readonly bulkPerMinute: number;
  readonly perMinute: number;
}

/** Decode the server's JSON for a {@link Rate}. */
export function decodeRate(r: any, T: TemporalLike): Rate {
  return {
    bulkPerMinute: r["bulk_per_minute"],
    perMinute: r["per_minute"],
  };
}

/**
 * How a MIC reaches its answer (SPEC: calendar-membership). The MIC pages
 * state the same.
 */
export interface ResolutionDto {
  /**
   * `own`: the venue is answered directly. `operating_mic`: through its
   * operating MIC. `country`: through the one calendar for its country.
   * The last two are inferences, not checked claims.
   */
  readonly kind: string;
  /**
   * The MIC or country that answers.
   */
  readonly via: string;
}

/** Decode the server's JSON for a {@link ResolutionDto}. */
export function decodeResolutionDto(r: any, T: TemporalLike): ResolutionDto {
  return {
    kind: r["kind"],
    via: r["via"],
  };
}

export interface RunningSession {
  readonly close: Temporal.ZonedDateTime;
  readonly name: string;
  readonly open: Temporal.ZonedDateTime;
  /**
   * Which products these hours are for, in the venue's own words. **Absent
   * means the whole venue**, which is almost every calendar.
   */
  readonly products?: string;
  /**
   * The day this session belongs to, which may not be the day it started on.
   */
  readonly tradeDate: Temporal.PlainDate;
  readonly verification: VerificationDto;
}

/** Decode the server's JSON for a {@link RunningSession}. */
export function decodeRunningSession(r: any, T: TemporalLike): RunningSession {
  return {
    close: T.ZonedDateTime.from(r["close"]),
    name: r["name"],
    open: T.ZonedDateTime.from(r["open"]),
    products: r["products"] == null ? undefined : r["products"],
    tradeDate: T.PlainDate.from(r["trade_date"]),
    verification: r["verification"],
  };
}

export interface SessionDto {
  readonly breaks: BreakDto[];
  readonly close: Temporal.ZonedDateTime;
  readonly name: string;
  /**
   * RFC 3339, in the venue's own zone. A session close is a zoned instant,
   * never a naive local time.
   */
  readonly open: Temporal.ZonedDateTime;
  /**
   * Which products keep these hours, in the venue's own words. **Absent
   * means the whole venue**, which is almost every calendar and every
   * session on it.
   */
  readonly products?: string;
  readonly provenance?: Provenance;
  readonly verification: VerificationDto;
}

/** Decode the server's JSON for a {@link SessionDto}. */
export function decodeSessionDto(r: any, T: TemporalLike): SessionDto {
  return {
    breaks: r["breaks"] == null ? [] : r["breaks"].map((x: any) => decodeBreakDto(x, T)),
    close: T.ZonedDateTime.from(r["close"]),
    name: r["name"],
    open: T.ZonedDateTime.from(r["open"]),
    products: r["products"] == null ? undefined : r["products"],
    provenance: r["provenance"] == null ? undefined : decodeProvenance(r["provenance"], T),
    verification: r["verification"],
  };
}

/**
 * A day stepped over: not a weekend, and not trading.
 */
export interface SkippedDay {
  readonly date: Temporal.PlainDate;
  readonly kind: DayKindDto;
  readonly reason?: string;
}

/** Decode the server's JSON for a {@link SkippedDay}. */
export function decodeSkippedDay(r: any, T: TemporalLike): SkippedDay {
  return {
    date: T.PlainDate.from(r["date"]),
    kind: r["kind"],
    reason: r["reason"] == null ? undefined : r["reason"],
  };
}

export interface StatusesBody {
  /**
   * RFC 3339. Answer from the dataset Diurn was serving at that instant
   * (Enterprise).
   */
  readonly asOf?: Temporal.Instant;
  /**
   * RFC 3339. Default: now.
   */
  readonly at?: Temporal.Instant;
  readonly mics: string[];
}

/** Decode the server's JSON for a {@link StatusesBody}. */
export function decodeStatusesBody(r: any, T: TemporalLike): StatusesBody {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    at: r["at"] == null ? undefined : T.Instant.from(r["at"]),
    mics: r["mics"] == null ? [] : [...r["mics"]],
  };
}

export interface StatusesResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  readonly at: Temporal.Instant;
  readonly dataset?: DatasetServed;
  readonly venues: Record<string, VenueStatus>;
}

/** Decode the server's JSON for a {@link StatusesResponse}. */
export function decodeStatusesResponse(r: any, T: TemporalLike): StatusesResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    at: T.Instant.from(r["at"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    venues: Object.fromEntries(Object.entries(r["venues"]).map(([k, x]: [string, any]) => [k, decodeVenueStatus(x, T)])),
  };
}

export interface StatusResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  readonly at: Temporal.Instant;
  readonly dataset?: DatasetServed;
  /**
   * The civil day the instant falls on, in the venue's zone.
   */
  readonly day: DayDto;
  /**
   * Present when the request was keyed by MIC rather than by calendar.
   */
  readonly mic?: string;
  readonly nextClose?: Temporal.ZonedDateTime;
  readonly nextOpen?: Temporal.ZonedDateTime;
  readonly running?: RunningSession;
  /**
   * `running`, `closed`, or `unknown`. **Not a boolean**: a day the engine
   * cannot compute is not a closed one, and collapsing the two is the
   * failure that loses trust.
   */
  readonly state: StateDto;
}

/** Decode the server's JSON for a {@link StatusResponse}. */
export function decodeStatusResponse(r: any, T: TemporalLike): StatusResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    at: T.Instant.from(r["at"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    day: decodeDayDto(r["day"], T),
    mic: r["mic"] == null ? undefined : r["mic"],
    nextClose: r["next_close"] == null ? undefined : T.ZonedDateTime.from(r["next_close"]),
    nextOpen: r["next_open"] == null ? undefined : T.ZonedDateTime.from(r["next_open"]),
    running: r["running"] == null ? undefined : decodeRunningSession(r["running"], T),
    state: r["state"],
  };
}

export interface StepResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  readonly dataset?: DatasetServed;
  /**
   * The trading day reached.
   */
  readonly date: Temporal.PlainDate;
  readonly from: Temporal.PlainDate;
  readonly kind: DayKindDto;
  readonly mic: string;
  readonly n: number;
  /**
   * Non-trading days passed over that are not weekends: why the answer is
   * where it is.
   */
  readonly skipped: SkippedDay[];
  /**
   * With `on_unknown=skip`: `unknown` days passed over uncounted.
   */
  readonly unknownSkipped: Temporal.PlainDate[];
}

/** Decode the server's JSON for a {@link StepResponse}. */
export function decodeStepResponse(r: any, T: TemporalLike): StepResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    date: T.PlainDate.from(r["date"]),
    from: T.PlainDate.from(r["from"]),
    kind: r["kind"],
    mic: r["mic"],
    n: r["n"],
    skipped: r["skipped"].map((x: any) => decodeSkippedDay(x, T)),
    unknownSkipped: r["unknown_skipped"] == null ? [] : r["unknown_skipped"].map((x: any) => T.PlainDate.from(x)),
  };
}

/**
 * A date and whether the venue trades on it, and nothing else.
 */
export interface TradingDaysResponse {
  /**
   * With `as_of`: the instant asked about. Absent otherwise.
   */
  readonly asOf?: Temporal.Instant;
  readonly dataset?: DatasetServed;
  /**
   * The dates once, in order, shared by every venue below. Columnar rather
   * than pairs because the endpoint takes many venues, and pairs would
   * repeat the dates for each — and because `zip(dates, trading)` is one
   * line in every language that would ask for this.
   */
  readonly dates: Temporal.PlainDate[];
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;
  /**
   * One series per requested MIC. See [`BulkResponse::venues`] for why they
   * are not deduplicated.
   */
  readonly venues: Record<string, TradingSeries>;
}

/** Decode the server's JSON for a {@link TradingDaysResponse}. */
export function decodeTradingDaysResponse(r: any, T: TemporalLike): TradingDaysResponse {
  return {
    asOf: r["as_of"] == null ? undefined : T.Instant.from(r["as_of"]),
    dataset: r["dataset"] == null ? undefined : decodeDatasetServed(r["dataset"], T),
    dates: r["dates"].map((x: any) => T.PlainDate.from(x)),
    from: T.PlainDate.from(r["from"]),
    to: T.PlainDate.from(r["to"]),
    venues: Object.fromEntries(Object.entries(r["venues"]).map(([k, x]: [string, any]) => [k, decodeTradingSeries(x, T)])),
  };
}

export interface TradingSeries {
  /**
   * `true` when any session runs — an early close and a shortened holiday
   * session both count, because the venue does trade.
   */
  readonly trading: (boolean | null)[];
  /**
   * How many entries above are `null`.
   */
  readonly unknown: number;
}

/** Decode the server's JSON for a {@link TradingSeries}. */
export function decodeTradingSeries(r: any, T: TemporalLike): TradingSeries {
  return {
    trading: [...r["trading"]],
    unknown: r["unknown"],
  };
}

/**
 * An account's usage against its plan (SPEC-pricing §6.4): what
 * `GET /v1/usage` answers, and what the account page shows.
 */
export interface UsageView {
  readonly horizon: DataWindow;
  readonly micsDay: MicWindow;
  readonly micsMonth: MicWindow;
  /**
   * The plan id.
   */
  readonly plan: string;
  readonly rate: Rate;
  readonly venueDays?: VenueDays;
}

/** Decode the server's JSON for a {@link UsageView}. */
export function decodeUsageView(r: any, T: TemporalLike): UsageView {
  return {
    horizon: decodeDataWindow(r["horizon"], T),
    micsDay: decodeMicWindow(r["mics_day"], T),
    micsMonth: decodeMicWindow(r["mics_month"], T),
    plan: r["plan"],
    rate: decodeRate(r["rate"], T),
    venueDays: r["venue_days"] == null ? undefined : decodeVenueDays(r["venue_days"], T),
  };
}

/**
 * One venue's day, in a row-oriented list.
 */
export interface VenueDay {
  readonly date: Temporal.PlainDate;
  readonly kind: DayKindDto;
  readonly products?: ProductSplitDto;
  readonly provenance?: Provenance;
  readonly reason?: string;
  readonly sessions: SessionDto[];
  readonly verification: VerificationDto;
  readonly mic: string;
}

/** Decode the server's JSON for a {@link VenueDay}. */
export function decodeVenueDay(r: any, T: TemporalLike): VenueDay {
  return {
    date: T.PlainDate.from(r["date"]),
    kind: r["kind"],
    products: r["products"] == null ? undefined : decodeProductSplitDto(r["products"], T),
    provenance: r["provenance"] == null ? undefined : decodeProvenance(r["provenance"], T),
    reason: r["reason"] == null ? undefined : r["reason"],
    sessions: r["sessions"] == null ? [] : r["sessions"].map((x: any) => decodeSessionDto(x, T)),
    verification: r["verification"],
    mic: r["mic"],
  };
}

export interface VenueDays {
  readonly max: number;
  /**
   * The start of the next billing month.
   */
  readonly resetsAt?: Temporal.Instant;
  readonly used: number;
}

/** Decode the server's JSON for a {@link VenueDays}. */
export function decodeVenueDays(r: any, T: TemporalLike): VenueDays {
  return {
    max: r["max"],
    resetsAt: r["resets_at"] == null ? undefined : T.Instant.from(r["resets_at"]),
    used: r["used"],
  };
}

export interface VenueResponse {
  readonly country?: string;
  readonly mic: string;
  readonly name: string;
  readonly operatingMic: string;
  /**
   * The product schedules the venue's answers distinguish, in the venue's
   * own names. Empty for almost every venue.
   */
  readonly products: string[];
  readonly resolution?: ResolutionDto;
  readonly status: string;
  /**
   * The IANA zone the venue's sessions are quoted in. Absent when no
   * calendar answers the venue.
   */
  readonly timezone?: string;
}

/** Decode the server's JSON for a {@link VenueResponse}. */
export function decodeVenueResponse(r: any, T: TemporalLike): VenueResponse {
  return {
    country: r["country"] == null ? undefined : r["country"],
    mic: r["mic"],
    name: r["name"],
    operatingMic: r["operating_mic"],
    products: [...r["products"]],
    resolution: r["resolution"] == null ? undefined : decodeResolutionDto(r["resolution"], T),
    status: r["status"],
    timezone: r["timezone"] == null ? undefined : r["timezone"],
  };
}

export interface VenuesResponse {
  /**
   * Pass as `cursor` for the next page; null on the last.
   */
  readonly nextCursor?: string;
  readonly venues: VenueResponse[];
}

/** Decode the server's JSON for a {@link VenuesResponse}. */
export function decodeVenuesResponse(r: any, T: TemporalLike): VenuesResponse {
  return {
    nextCursor: r["next_cursor"] == null ? undefined : r["next_cursor"],
    venues: r["venues"].map((x: any) => decodeVenueResponse(x, T)),
  };
}

/**
 * One venue's entry: `StatusResponse` without the `at` the response states
 * once.
 */
export interface VenueStatus {
  readonly day: DayDto;
  readonly nextClose?: Temporal.ZonedDateTime;
  readonly nextOpen?: Temporal.ZonedDateTime;
  readonly running?: RunningSession;
  readonly state: StateDto;
}

/** Decode the server's JSON for a {@link VenueStatus}. */
export function decodeVenueStatus(r: any, T: TemporalLike): VenueStatus {
  return {
    day: decodeDayDto(r["day"], T),
    nextClose: r["next_close"] == null ? undefined : T.ZonedDateTime.from(r["next_close"]),
    nextOpen: r["next_open"] == null ? undefined : T.ZonedDateTime.from(r["next_open"]),
    running: r["running"] == null ? undefined : decodeRunningSession(r["running"], T),
    state: r["state"],
  };
}

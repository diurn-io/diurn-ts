// Typed errors: a caller tests the class (`instanceof`), never a message.
//
// Every error the API returns carries a stable tag (`error`), and each tag
// has a class here, as in diurn-py's errors.py. Refusals from a plan's limits
// carry their numbers, so a program can act on them (wait until `resetsAt`,
// narrow to `allowedFrom`..`allowedTo`) rather than retry blindly.

import type { TemporalLike } from "./generated/models.ts";

/** Every error this package throws. */
export class DiurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The API answered with an error. `error` is its stable tag; `body` the
 * response as sent, for anything not lifted into a field. */
export class ApiError extends DiurnError {
  readonly status: number;
  readonly error: string;
  readonly body: Record<string, unknown>;

  constructor(status: number, error: string, message: string, body: Record<string, unknown>) {
    super(message ? `${error}: ${message}` : error);
    this.status = status;
    this.error = error;
    this.body = body;
  }
}

/** No key (`needs_key`), or a key that is not active (`unauthorized`). Keys
 * are free at https://diurn.io/signin/; set `DIURN_API_KEY` or pass `apiKey`. */
export class AuthError extends ApiError {}

/** No such MIC, or no calendar answers it. */
export class UnknownVenue extends ApiError {}

/** The request could not be understood: a malformed date, too many days, or
 * `asOf` outside the archive's record. */
export class BadRequest extends ApiError {}

/** The service could not answer just now (503), for example an `asOf`
 * dataset that could not be loaded. */
export class Unavailable extends ApiError {
  /** The server's `Retry-After`, in milliseconds, where it sent one. */
  readonly retryAfterMs: number | undefined;

  constructor(status: number, error: string, message: string, body: Record<string, unknown>, retryAfterMs?: number) {
    super(status, error, message, body);
    this.retryAfterMs = retryAfterMs;
  }
}

/** A refusal from the plan's limits. `limit` is `{kind, used, max}` where the
 * API sends it; `resetsAt` when the limit eases; `upgrade` where to get more. */
export class OverLimit extends ApiError {
  readonly limit: Record<string, unknown> | undefined;
  readonly resetsAt: Temporal.Instant | undefined;
  readonly upgrade: string | undefined;

  constructor(status: number, error: string, message: string, body: Record<string, unknown>, T: TemporalLike) {
    super(status, error, message, body);
    this.limit = (body["limit"] as Record<string, unknown> | undefined) ?? undefined;
    this.resetsAt = typeof body["resets_at"] === "string" ? T.Instant.from(body["resets_at"]) : undefined;
    this.upgrade = typeof body["upgrade"] === "string" ? body["upgrade"] : undefined;
  }
}

/** The plan does not include this: an endpoint, provenance or `asOf` (403). */
export class NotInPlan extends OverLimit {}

/** Dates outside the plan's window (403), refused rather than trimmed.
 * `undefined` is unbounded. */
export class OutOfWindow extends OverLimit {
  readonly allowedFrom: Temporal.PlainDate | undefined;
  readonly allowedTo: Temporal.PlainDate | undefined;

  constructor(status: number, error: string, message: string, body: Record<string, unknown>, T: TemporalLike) {
    super(status, error, message, body, T);
    const allowed = (body["allowed"] ?? {}) as Record<string, unknown>;
    this.allowedFrom = typeof allowed["from"] === "string" ? T.PlainDate.from(allowed["from"]) : undefined;
    this.allowedTo = typeof allowed["to"] === "string" ? T.PlainDate.from(allowed["to"]) : undefined;
  }
}

/** Asking for this MIC would exceed a unique-MIC cap (429). Asking again for
 * one of `micsInUse` is free. */
export class MicCapExceeded extends OverLimit {
  readonly micsInUse: string[];

  constructor(status: number, error: string, message: string, body: Record<string, unknown>, T: TemporalLike) {
    super(status, error, message, body, T);
    this.micsInUse = Array.isArray(body["mics_in_use"]) ? body["mics_in_use"].map(String) : [];
  }
}

/** Too many requests a minute (429). */
export class RateLimited extends OverLimit {
  /** The server's `Retry-After`, in milliseconds, where it sent one. */
  readonly retryAfterMs: number | undefined;

  constructor(
    status: number,
    error: string,
    message: string,
    body: Record<string, unknown>,
    T: TemporalLike,
    retryAfterMs?: number,
  ) {
    super(status, error, message, body, T);
    this.retryAfterMs = retryAfterMs;
  }
}

/** Diurn cannot say whether the market trades on a date: the API's
 * `422 indeterminate`, or a calendar asked about an `unknown` day. Diurn never
 * reports such a day as open or closed. */
export class Indeterminate extends DiurnError {
  readonly date: Temporal.PlainDate | undefined;
  /** The API's response, when the API said so. */
  readonly response: ApiError | undefined;

  constructor(date: Temporal.PlainDate | undefined, response?: ApiError) {
    super(`cannot be answered for ${date?.toString() ?? "a date"}`);
    this.date = date;
    this.response = response;
  }
}

/** The API could not be reached, or answered with something that is not the
 * API (a proxy's page, a broken connection, a timeout). */
export class TransportError extends DiurnError {}

/** A response that does not have the shape it should. */
export class DecodeError extends DiurnError {}

/** Not a MIC: four characters, letters and digits. */
export class InvalidMic extends DiurnError {
  readonly mic: string;

  constructor(mic: string) {
    super(`not a MIC: ${JSON.stringify(mic)}`);
    this.mic = mic;
  }
}

/** An argument the API would refuse, caught before any request. */
export class InvalidArgument extends DiurnError {}

/** A calendar was asked about a date outside the range it loaded. It never
 * fetches more on its own: load a wider range. */
export class OutsideLoaded extends DiurnError {
  readonly date: Temporal.PlainDate;
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;

  constructor(date: Temporal.PlainDate, from: Temporal.PlainDate, to: Temporal.PlainDate) {
    super(`${date} is outside the loaded range ${from} to ${to}`);
    this.date = date;
    this.from = from;
    this.to = to;
  }
}

/** A date that is not a session, where one was required. */
export class NotASession extends DiurnError {
  readonly date: Temporal.PlainDate;

  constructor(date: Temporal.PlainDate) {
    super(`${date} is not a session`);
    this.date = date;
  }
}

/** No `Temporal` to work with: this runtime has none built in, and none was
 * given. Pass one: `new Client({ temporal: Temporal })`, with `Temporal` from
 * `temporal-polyfill` (or `@js-temporal/polyfill`). */
export class NoTemporal extends DiurnError {
  constructor() {
    super(
      "this runtime has no Temporal: pass one, e.g. `import { Temporal } from \"temporal-polyfill\"` " +
        "and `new Client({ temporal: Temporal })`",
    );
  }
}

/** The error for an API error response: by its tag, then by its status. */
export function fromResponse(
  status: number,
  body: Record<string, unknown>,
  T: TemporalLike,
  retryAfterMs?: number,
): ApiError | Indeterminate {
  const error = typeof body["error"] === "string" && body["error"] ? body["error"] : `http_${status}`;
  const message = typeof body["message"] === "string" ? body["message"] : "";
  const indeterminate = () => {
    const date = typeof body["date"] === "string" ? T.PlainDate.from(body["date"]) : undefined;
    return new Indeterminate(date, new ApiError(status, error, message, body));
  };
  switch (error) {
    case "needs_key":
    case "unauthorized":
      return new AuthError(status, error, message, body);
    case "not_in_plan":
      return new NotInPlan(status, error, message, body, T);
    case "out_of_window":
      return new OutOfWindow(status, error, message, body, T);
    case "mic_cap_exceeded":
      return new MicCapExceeded(status, error, message, body, T);
    case "rate_limited":
      return new RateLimited(status, error, message, body, T, retryAfterMs);
    case "indeterminate":
      return indeterminate();
  }
  switch (status) {
    case 400:
      return new BadRequest(status, error, message, body);
    case 401:
      return new AuthError(status, error, message, body);
    case 404:
      return new UnknownVenue(status, error, message, body);
    case 422:
      return indeterminate();
    case 429:
      // A plan's refusal this version does not name still carries its numbers.
      return new OverLimit(status, error, message, body, T);
    case 503:
      return new Unavailable(status, error, message, body, retryAfterMs);
    default:
      return new ApiError(status, error, message, body);
  }
}

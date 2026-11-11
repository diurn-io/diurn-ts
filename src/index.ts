/// <reference lib="esnext.temporal" preserve="true" />
/**
 * Diurn: exchange calendars and trading hours for the world's markets, from
 * the Diurn API.
 *
 * ```ts
 * import { Client } from "diurn";
 * const client = new Client(); // DIURN_API_KEY; Temporal native, or `temporal`
 * const xnys = await client.calendar("XNYS", "2026-11-01", "2026-11-30");
 * xnys.isSession("2026-11-26"); // false: Thanksgiving
 * ```
 *
 * @packageDocumentation
 */

export { Calendar, isSessionDay } from "./calendar.ts";
export type { CalendarOptions, Day, ScheduleRow, Session } from "./calendar.ts";
export { Client, mic } from "./client.ts";
export type {
  AsOf,
  ExceptionsOptions,
  JointOptions,
  SessionsOptions,
  StatusOptions,
  StepOptions,
  VenuesQuery,
} from "./client.ts";
export {
  ApiError,
  AuthError,
  BadRequest,
  DecodeError,
  DiurnError,
  Indeterminate,
  InvalidArgument,
  InvalidMic,
  MicCapExceeded,
  NoTemporal,
  NotASession,
  NotInPlan,
  OutOfWindow,
  OutsideLoaded,
  OverLimit,
  RateLimited,
  TransportError,
  Unavailable,
  UnknownVenue,
} from "./errors.ts";
export type * as models from "./generated/models.ts";
export type { DateLike, InstantLike } from "./temporal.ts";
export type { ClientOptions } from "./transport.ts";
export { VERSION } from "./transport.ts";

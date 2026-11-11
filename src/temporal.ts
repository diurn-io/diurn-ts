// Which `Temporal` to build values with, and how arguments become its types.
//
// The package has no dependencies: it uses `globalThis.Temporal` where the
// runtime has one (recent browsers), and otherwise the one a caller passes
// (`new Client({ temporal })`, e.g. from `temporal-polyfill`). Values are
// converted through their ISO strings, so a date from another implementation
// (native, or a different polyfill) is accepted as readily as its own.

import { InvalidArgument, NoTemporal } from "./errors.ts";
import type { TemporalLike } from "./generated/models.ts";

/** A date: a `Temporal.PlainDate`, or `"YYYY-MM-DD"`. */
export type DateLike = Temporal.PlainDate | string;

/** An instant: a `Temporal.Instant` or `ZonedDateTime`, or an ISO string with
 * an offset or `Z`. A string without one is refused: it is not an instant. */
export type InstantLike = Temporal.Instant | Temporal.ZonedDateTime | string;

export function resolveTemporal(given?: TemporalLike): TemporalLike {
  const found = given ?? (globalThis as { Temporal?: TemporalLike }).Temporal;
  if (!found) throw new NoTemporal();
  return found;
}

export function toDate(value: DateLike, T: TemporalLike): Temporal.PlainDate {
  try {
    return T.PlainDate.from(String(value).slice(0, 10));
  } catch (e) {
    throw new InvalidArgument(`not a date: ${JSON.stringify(String(value))} (${(e as Error).message})`);
  }
}

export function toInstant(value: InstantLike, T: TemporalLike): Temporal.Instant {
  const text = typeof value === "object" && "toInstant" in value ? value.toInstant().toString() : String(value);
  try {
    return T.Instant.from(text);
  } catch (e) {
    throw new InvalidArgument(`not an instant, with an offset or Z: ${JSON.stringify(text)} (${(e as Error).message})`);
  }
}

/** Order two instants, of any implementation, by their nanoseconds. */
export function compareInstants(
  a: Temporal.Instant | Temporal.ZonedDateTime,
  b: Temporal.Instant | Temporal.ZonedDateTime,
): number {
  return a.epochNanoseconds < b.epochNanoseconds ? -1 : a.epochNanoseconds > b.epochNanoseconds ? 1 : 0;
}

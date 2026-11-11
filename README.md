# diurn

Exchange calendars and trading hours for the world's markets, from the
[Diurn API](https://diurn.io): every session, holiday and early close, keyed
by MIC, with how each day is evidenced.

```sh
npm install diurn
```

An API key is free at <https://diurn.io/signin/>; set `DIURN_API_KEY`.

The package has no dependencies and runs in Node (20 and later), Deno, Bun and
browsers. Dates and times are [`Temporal`](https://tc39.es/proposal-temporal/)
values: `Temporal.PlainDate` for a day, `Temporal.ZonedDateTime` in the
venue's own zone for a session's times. Where the runtime has `Temporal` built
in, it is used; elsewhere (Node, for now) pass one from a polyfill:

```ts
import { Client } from "diurn";
import { Temporal } from "temporal-polyfill"; // or @js-temporal/polyfill

const client = new Client({ temporal: Temporal });
```

Without either, `new Client()` throws `NoTemporal`. Types need TypeScript 6.0
or later, which ships `Temporal`'s.

## A calendar

Load a venue's calendar for a range once, then ask it anything about that
range without another request. The names are
[`exchange_calendars`](https://github.com/gerrymanoim/exchange_calendars)',
in camelCase:

```ts
const xnys = await client.calendar("XNYS", "2026-01-01", "2026-12-31");

xnys.isSession("2026-11-26");            // false: Thanksgiving
xnys.nextSession("2026-11-25");          // 2026-11-27
xnys.sessionClose("2026-11-27");         // 2026-11-27T13:00:00-05:00[America/New_York]
xnys.sessionsDistance("2026-11-01", "2026-11-30"); // 20
xnys.isOpenAtTime("2026-11-27T17:30:00Z");         // true
xnys.schedule("2026-11-24", "2026-11-30");         // open, break, close per session

const xtks = await client.calendar("XTKS", "2026-11-01", "2026-11-30");
xtks.sessionBreakStart("2026-11-02");    // 11:30, Tokyo's lunch
```

Dates may be `Temporal.PlainDate` or `"YYYY-MM-DD"`; instants a
`Temporal.Instant`, a `ZonedDateTime`, or an ISO string with an offset.

Nothing is guessed. A day Diurn cannot answer is neither open nor closed: a
question that depends on it throws `Indeterminate`. A question that reaches
past the loaded range throws `OutsideLoaded`, rather than fetching more behind
your back; load a wider range. A session is what `/v1/trading-days` counts:
an open day, an early close, a day open for some products, or a holiday that
still trades (NSE's Muhurat session).

A venue with product schedules (CME's Equity Index, Energy and Metals, ...)
answers for one with `{ product }`:

```ts
const cme = await client.calendar("XCEC", "2026-01-01", "2026-12-31", { product: "Equity Index" });
cme.products; // the schedules it keeps
```

## The API

Every endpoint is a method returning the API's shapes as typed objects, with
camelCase fields and `Temporal` dates:

```ts
const now = await client.statuses(["XNYS", "XLON", "XTKS"]);
now.venues["XLON"]?.state;               // "running", "closed", ...

const step = await client.nextTradingDay("XNYS", "2026-11-25");
step.date;                               // 2026-11-27
step.skipped[0]?.reason;                 // "Thanksgiving Day"

const joint = await client.jointNextTradingDay(["XNYS", "XLON"], "2026-12-23", { n: 2 });
const days = await client.exceptions(["XNYS", "XLON"], "2026-11-01", "2026-12-31");
```

Also `health`, `venue`, `venues`, `usage`, `sessions`, `day`, `status`,
`nextOpen`, `nextClose`, `previousTradingDay`, `countTradingDays`,
`sessionsBulk`, `tradingDays` and `jointPreviousTradingDay`. Options go in a
trailing object; on Enterprise, every data method takes `asOf` to answer from
the dataset Diurn was serving at an instant. `client.lastHeaders` holds the
last response's usage headers.

A client is set up with `apiKey`, `baseUrl` (`DIURN_API_URL`), `timeoutMs`,
`retries`, `maxWaitMs`, `backoffMs`, `temporal` and `fetch`. Retries are off
by default. With `retries`, a rate limit is waited out after the server's
`Retry-After`, and a 503 or a failed connection backs off from half a second;
a plan's refusal is never retried, and a wait longer than `maxWaitMs` is
thrown rather than slept.

## Errors

Typed, never prose; test them with `instanceof`. All extend `DiurnError`:
`AuthError` (no or inactive key), `UnknownVenue`, `BadRequest`, `NotInPlan`,
`OutOfWindow` (with `allowedFrom` and `allowedTo`), `MicCapExceeded` (with
`micsInUse` and `resetsAt`), `RateLimited` (with `retryAfterMs`), `OverLimit`
(any other plan refusal), `Unavailable`, `Indeterminate` (with `date`),
`TransportError`, `DecodeError`, `InvalidMic`, `InvalidArgument`,
`OutsideLoaded`, `NotASession` and `NoTemporal`. An error from the API extends
`ApiError` and keeps its response: `error.body`.

## Development

The wire layer (`src/generated/models.ts`) is generated from the API's
OpenAPI document and committed. To refresh it, from a checkout of
`diurn-platform`:

```sh
cargo run -p diurn-api -- --openapi > ../diurn-ts/openapi.json
node scripts/generate.mjs               # CI runs it with --check
```

`npm test` runs the sources directly (Node's type stripping) against
responses recorded from a local API server
(`node scripts/record.mjs http://127.0.0.1:8099`), so it needs no network or
key. `npm run build` writes `dist/`.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or
  <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or
  <http://opensource.org/licenses/MIT>)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you, as defined in the Apache-2.0 license, shall be
dual licensed as above, without any additional terms or conditions.

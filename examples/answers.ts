// A few answers from a live API, to compare with another client's:
//
//   DIURN_API_URL=http://127.0.0.1:8099 node examples/answers.ts

import { Temporal } from "temporal-polyfill";

import { Client } from "../src/index.ts";

const client = new Client({ temporal: Temporal });
const xnys = await client.calendar("XNYS", "2026-01-01", "2027-12-31");
console.log(`XNYS sessions in Nov 2026: ${xnys.sessionsDistance("2026-11-01", "2026-11-30")}`);
console.log(`XNYS next session after 2026-12-31: ${xnys.nextSession("2026-12-31")}`);
console.log(`XNYS close on 2026-11-27: ${xnys.sessionClose("2026-11-27")}`);
const xtks = await client.calendar("XTKS", "2026-11-01", "2026-11-30");
console.log(`XTKS lunch on 2026-11-02 starts: ${xtks.sessionBreakStart("2026-11-02")?.toPlainTime().toString().slice(0, 5)}`);
const xnse = await client.calendar("XNSE", "2026-11-01", "2026-11-30");
console.log(`XNSE 2026-11-08 is a session: ${xnse.isSession("2026-11-08")}`);
const step = await client.nextTradingDay("XNYS", "2026-11-25");
console.log(`XNYS next trading day after 2026-11-25: ${step.date}`);
const joint = await client.jointNextTradingDay(["XNYS", "XLON"], "2026-12-23", { n: 2 });
console.log(`XNYS+XLON 2nd joint day after 2026-12-23: ${joint.date}`);

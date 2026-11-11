// Generate src/generated/models.ts from the API's OpenAPI document.
//
//   node scripts/generate.mjs           # rewrite the module
//   node scripts/generate.mjs --check   # exit 1 if it would change (CI)
//
// The wire layer is generated and committed (SPEC §7.1), by the same rules as
// diurn-py's tools/generate.py and diurn-rs's xtask: one interface per object
// schema, one literal union per string enum, and a decoder per interface that
// turns the server's JSON into these types. Fields are camelCase; dates are
// `Temporal.PlainDate`; instants are `Temporal.ZonedDateTime` or
// `Temporal.Instant` by the table below. Node only, no dependencies. Refresh
// the document first, from a diurn-platform checkout:
//
//   cargo run -p diurn-api -- --openapi > ../diurn-ts/openapi.json

import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const SPEC = path.join(ROOT, "openapi.json");
const OUT = path.join(ROOT, "src/generated/models.ts");

// Instants, which the document declares only as strings: diurn-rs's
// INSTANTS (xtask/src/main.rs), the same fields. The server writes the zoned
// ones with their IANA zone in brackets (RFC 9557).
const ZONED = "Temporal.ZonedDateTime";
const INSTANT = "Temporal.Instant";
const INSTANTS = new Map([
  ["BreakDto.start", ZONED],
  ["BreakDto.end", ZONED],
  ["SessionDto.open", ZONED],
  ["SessionDto.close", ZONED],
  ["RunningSession.open", ZONED],
  ["RunningSession.close", ZONED],
  ["InstantResponse.at", ZONED],
  ["StatusResponse.next_open", ZONED],
  ["StatusResponse.next_close", ZONED],
  ["VenueStatus.next_open", ZONED],
  ["VenueStatus.next_close", ZONED],
  ["InstantResponse.from", INSTANT],
  ["StatusResponse.at", INSTANT],
  ["StatusesResponse.at", INSTANT],
  ["StatusesBody.at", INSTANT],
  ["DatasetServed.served_from", INSTANT],
  ["DatasetServed.served_until", INSTANT],
  ["MicWindow.resets_at", INSTANT],
  ["VenueDays.resets_at", INSTANT],
  ["Health.built_at", INSTANT],
]);

const camelField = (name) => name.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = (name) =>
  name
    .split(/[_-]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");
const refName = (ref) => ref.split("/").pop();

/** The first paragraph of a description, as one JSDoc block. */
function jsdoc(text, indent = "") {
  const first = (text ?? "").trim().split("\n\n")[0].trim();
  if (!first) return "";
  const lines = first.split("\n").map((l) => l.trim().replaceAll("*/", "*\\/"));
  return `${indent}/**\n${lines.map((l) => `${indent} * ${l}`.trimEnd()).join("\n")}\n${indent} */\n`;
}

class Generator {
  constructor(schemas) {
    this.schemas = schemas;
    this.enums = new Map(); // name -> {doc, values}
    this.models = new Map(); // name -> {doc, fields}
  }

  static nullable(s) {
    if (Array.isArray(s.type) && s.type.includes("null")) {
      const rest = s.type.filter((t) => t !== "null");
      return [{ ...s, type: rest.length === 1 ? rest[0] : rest }, true];
    }
    for (const key of ["oneOf", "anyOf"]) {
      if (Array.isArray(s[key])) {
        const kept = s[key].filter((o) => o.type !== "null");
        if (kept.length === 1 && kept.length < s[key].length) return [kept[0], true];
      }
    }
    return [s, false];
  }

  /** {type, decode(expr)} for a schema that is not null. */
  resolve(s, owner, prop) {
    if (s.$ref) {
      const name = refName(s.$ref);
      if (this.schemas[name].enum) return { type: name, decode: (e) => e };
      return { type: name, decode: (e) => `decode${name}(${e}, T)` };
    }
    if (s.enum) {
      const alias = `${owner}${pascal(prop)}`;
      this.enums.set(alias, { doc: s.description, values: s.enum });
      return { type: alias, decode: (e) => e };
    }
    switch (s.type) {
      case "string": {
        const instant = INSTANTS.get(`${owner}.${prop}`) ?? (prop === "as_of" ? INSTANT : undefined);
        if (instant === ZONED) return { type: ZONED, decode: (e) => `T.ZonedDateTime.from(${e})` };
        if (instant === INSTANT || s.format === "date-time")
          return { type: INSTANT, decode: (e) => `T.Instant.from(${e})` };
        if (s.format === "date") return { type: "Temporal.PlainDate", decode: (e) => `T.PlainDate.from(${e})` };
        return { type: "string", decode: (e) => e };
      }
      case "integer":
      case "number":
        return { type: "number", decode: (e) => e };
      case "boolean":
        return { type: "boolean", decode: (e) => e };
      case "array": {
        const item = this.resolveItem(s.items, owner, prop);
        const decode = item.decode("x") === "x" ? (e) => `[...${e}]` : (e) => `${e}.map((x: any) => ${item.decode("x")})`;
        return { type: `${item.type.includes("|") ? `(${item.type})` : item.type}[]`, decode };
      }
      case "object": {
        if (s.additionalProperties !== undefined && !s.properties) {
          const v = s.additionalProperties;
          if (v === true || (typeof v === "object" && Object.keys(v).length === 0)) {
            return { type: "Record<string, unknown>", decode: (e) => `{ ...${e} }` };
          }
          const value = this.resolveItem(v, owner, prop);
          return {
            type: `Record<string, ${value.type}>`,
            decode: (e) =>
              value.decode("x") === "x"
                ? `{ ...${e} }`
                : `Object.fromEntries(Object.entries(${e}).map(([k, x]: [string, any]) => [k, ${value.decode("x")}]))`,
          };
        }
        if (s.properties) {
          const name = `${owner}${pascal(prop)}`;
          this.model(name, s);
          return { type: name, decode: (e) => `decode${name}(${e}, T)` };
        }
        return { type: "unknown", decode: (e) => e };
      }
      default:
        return { type: "unknown", decode: (e) => e };
    }
  }

  /** An array item or map value: `null` inside means "cannot say", kept. */
  resolveItem(s, owner, prop) {
    const [inner, isNull] = Generator.nullable(s);
    const r = this.resolve(inner, owner, prop);
    if (!isNull) return r;
    return { type: `${r.type} | null`, decode: (e) => (r.decode(e) === e ? e : `${e} === null ? null : ${r.decode(e)}`) };
  }

  properties(s) {
    if (Array.isArray(s.allOf)) {
      const props = new Map();
      const required = new Set();
      for (const part of s.allOf) {
        const p = this.properties(part.$ref ? this.schemas[refName(part.$ref)] : part);
        for (const [k, v] of p.props) props.set(k, v);
        for (const r of p.required) required.add(r);
      }
      return { props, required };
    }
    return { props: new Map(Object.entries(s.properties ?? {})), required: new Set(s.required ?? []) };
  }

  model(name, s) {
    if (this.models.has(name)) return;
    const model = { doc: s.description, fields: [] };
    this.models.set(name, model);
    const { props, required } = this.properties(s);
    for (const [key, prop] of props) {
      const [inner, isNull] = Generator.nullable(prop);
      const r = this.resolve(inner, name, key);
      const shape = required.has(key) && !isNull ? "required" : inner.type === "array" && !isNull ? "list" : "optional";
      model.fields.push({ key, type: r.type, decode: r.decode, shape, doc: prop.description });
    }
  }

  run() {
    for (const name of Object.keys(this.schemas).sort()) {
      const s = this.schemas[name];
      if (s.enum) this.enums.set(name, { doc: s.description, values: s.enum });
      else this.model(name, s);
    }
    return this.render();
  }

  render() {
    let out =
      "// Generated from openapi.json by scripts/generate.mjs. Do not edit.\n" +
      "//\n" +
      "// The API's shapes, one per schema, with a decoder each that turns the\n" +
      "// server's JSON into them: camelCase fields, `Temporal` dates and instants.\n\n" +
      "/* eslint-disable */\n\n" +
      "/** The `Temporal` implementation decoders build values with. */\n" +
      "export type TemporalLike = typeof Temporal;\n";
    for (const [name, { doc, values }] of [...this.enums].sort(([a], [b]) => a.localeCompare(b))) {
      out += `\n${jsdoc(doc)}export type ${name} = ${values.map((v) => JSON.stringify(v)).join(" | ")};\n`;
    }
    for (const [name, { doc, fields }] of [...this.models].sort(([a], [b]) => a.localeCompare(b))) {
      out += `\n${jsdoc(doc)}export interface ${name} {\n`;
      for (const f of fields) {
        const optional = f.shape === "optional" ? "?" : "";
        out += `${jsdoc(f.doc, "  ")}  readonly ${camelField(f.key)}${optional}: ${f.type};\n`;
      }
      out += "}\n";
      out += `\n/** Decode the server's JSON for a {@link ${name}}. */\n`;
      out += `export function decode${name}(r: any, T: TemporalLike): ${name} {\n  return {\n`;
      for (const f of fields) {
        const get = `r[${JSON.stringify(f.key)}]`;
        const value =
          f.shape === "required"
            ? f.decode(get)
            : f.shape === "list"
              ? `${get} == null ? [] : ${f.decode(get)}`
              : `${get} == null ? undefined : ${f.decode(get)}`;
        out += `    ${camelField(f.key)}: ${value},\n`;
      }
      out += "  };\n}\n";
    }
    return out;
  }
}

const spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));
const text = new Generator(spec.components.schemas).run();
if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== text) {
    console.error("src/generated/models.ts is stale: run node scripts/generate.mjs");
    process.exit(1);
  }
} else {
  fs.writeFileSync(OUT, text);
  console.log("wrote src/generated/models.ts");
}

import { readFileSync, readdirSync } from "node:fs";
import { parseCalendar } from "./src/miclub";
const dir = process.argv[2]!;
for (const f of readdirSync(dir).filter(
  (f) => f.startsWith("probe2.json.") && f.endsWith(".html"),
)) {
  const host = f.replace("probe2.json.", "").replace(".html", "");
  const p = parseCalendar(readFileSync(`${dir}/${f}`, "utf8"));
  const kinds = [
    ...new Set(p.cells.map((c) => `${c.holes}${c.layout ? ":" + c.layout : ""} [${c.heading}]`)),
  ];
  console.log(host.padEnd(32), String(p.cells.length).padStart(3), kinds.join(" | ").slice(0, 170));
}

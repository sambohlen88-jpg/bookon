import { writeFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { PoliteHttpClient } from "./src";
import { calendarUrl, parseCalendar } from "./src/miclub";
const [, , out, date, ...specs] = process.argv;
const http = new PoliteHttpClient({
  userAgent: "BookOnBot/0.1 (+https://bookon.au; info@bookon.au)",
  alsoObeyAgents: ["Claude-User"],
  maxRetries: 0,
  timeoutMs: 20000,
});
const results: Record<string, unknown>[] = [];
await Promise.all(
  specs.map(async (spec) => {
    const [host, resource = "3000000"] = spec.split("@");
    const config = { baseUrl: `https://${host}`, bookingResourceId: resource };
    const url = calendarUrl(config, date!);
    const r: Record<string, unknown> = { host, resource };
    try {
      const html = await http.getText(url);
      const $ = cheerio.load(html);
      writeFileSync(`${out}.${host}@${resource}.html`, html);
      r.title = $("title").first().text().replace(/\s+/g, " ").trim();
      r.resourceName = $(".resourceName").first().text().trim();
      r.headings = $("div.feeGroupRow .row-heading > h3")
        .map((_, h) => $(h).text().replace(/\s+/g, " ").trim())
        .get();
      r.captcha = /publicCaptchaEnabled\s*=\s*true/.test(html);
      try {
        const p = parseCalendar(html);
        r.cells = p.cells.length;
        r.days = [...new Set(p.cells.map((c) => c.date))].length;
      } catch (e) {
        r.parseError = (e as Error).message;
      }
    } catch (e) {
      r.error = (e as Error).message.slice(0, 140);
    }
    results.push(r);
  }),
);
writeFileSync(out!, JSON.stringify(results, null, 1));
console.log(`probed ${results.length}`);

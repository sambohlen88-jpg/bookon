import { writeFileSync } from "node:fs";
import { PoliteHttpClient } from "./src";
const [, , out, ...urls] = process.argv;
const http = new PoliteHttpClient({
  userAgent: "BookOnBot/0.1 (+https://bookon.au; info@bookon.au)",
  alsoObeyAgents: ["Claude-User"],
  maxRetries: 0,
});
for (const [i, url] of urls.entries()) {
  try {
    const body = await http.getText(url);
    writeFileSync(`${out}/${i}.txt`, body);
    console.log("OK", url, body.length);
  } catch (e) {
    console.log("FAIL", url, (e as Error).message.slice(0, 200));
  }
}

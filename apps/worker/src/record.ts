import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HttpClient } from "@bookon/core";

/** Wraps an HTTP client and saves every page it fetches, for refreshing test fixtures. */
export class RecordingHttpClient implements HttpClient {
  private saved = 0;

  constructor(
    private readonly inner: HttpClient & { requestCount: number },
    private readonly directory: string,
  ) {
    mkdirSync(directory, { recursive: true });
  }

  get requestCount(): number {
    return this.inner.requestCount;
  }

  async getText(url: string): Promise<string> {
    const body = await this.inner.getText(url);
    const name = `${String(++this.saved).padStart(2, "0")}-${slugify(url)}.html`;
    writeFileSync(
      join(this.directory, name),
      `<!-- recorded from ${url} at ${new Date().toISOString()} -->\n${body}`,
    );
    return body;
  }
}

function slugify(url: string): string {
  const { hostname, pathname, search } = new URL(url);
  return `${hostname}${pathname}${search}`
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

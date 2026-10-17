import { readFileSync } from "node:fs";
import type { Course, HttpClient } from "@bookon/core";

export function fixture(path: string): string {
  return readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
}

/** Serves fixtures by URL and records every request. Unknown URLs fail like a 404 would. */
export class FakeHttp implements HttpClient {
  readonly requested: string[] = [];
  constructor(private readonly routes: (url: URL) => string | undefined) {}

  async getText(url: string): Promise<string> {
    this.requested.push(url);
    const body = this.routes(new URL(url));
    if (body === undefined) throw new Error(`No fixture for ${url}`);
    return body;
  }
}

export function testCourse(overrides: Partial<Course>): Course {
  return {
    id: "course-1",
    clubId: "club-1",
    name: "Test Course",
    slug: "test-course",
    suburb: "Perth",
    latitude: null,
    longitude: null,
    holes: 18,
    platform: "miclub",
    platformConfig: {},
    websiteUrl: "https://example.com",
    bookingUrl: "https://example.com/book",
    enabled: true,
    ...overrides,
  };
}

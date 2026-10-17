import { describe, expect, it } from "vitest";
import { courseArtSvg, courseArtUrl } from "@/lib/course-art";
import { GET } from "@/app/art/[name]/route";

describe("course illustrations", () => {
  it("draw the same picture for a course every time", () => {
    expect(courseArtSvg("collier-park")).toBe(courseArtSvg("collier-park"));
  });

  it("draw different courses differently", () => {
    expect(courseArtSvg("collier-park")).not.toBe(courseArtSvg("the-cut"));
  });

  it("show the course's country, with colours for light and dark mode", () => {
    const svg = courseArtSvg("broome");
    expect(svg).toContain("var(--earth)");
    expect(svg).toContain("var(--water)");
    expect(svg).toContain("prefers-color-scheme:dark");
  });

  it("have a wide version for banners", () => {
    expect(courseArtSvg("x", { wide: true })).toContain('viewBox="0 0 1200 225"');
    expect(courseArtUrl("the-cut", true)).toMatch(/^\/art\/the-cut-wide\.svg\?v=\d+$/);
  });

  it("are served as cached images, and nothing else is", async () => {
    const serve = (name: string) =>
      GET(new Request("http://x/"), { params: Promise.resolve({ name }) });
    const ok = await serve("the-cut-wide.svg");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("image/svg+xml");
    expect(ok.headers.get("cache-control")).toContain("immutable");
    expect(await ok.text()).toContain('viewBox="0 0 1200 225"');
    expect((await serve("../etc/passwd")).status).toBe(404);
    expect((await serve("x.png")).status).toBe(404);
    expect((await serve("<script>.svg")).status).toBe(404);
  });
});

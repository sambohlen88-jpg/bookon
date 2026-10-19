import { describe, expect, it } from "vitest";
import { hasSitePassword, sitePassword } from "./private-site";

const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

describe("private test mode", () => {
  it("is on only when a password is set", () => {
    expect(sitePassword({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      sitePassword({ BOOKON_SITE_PASSWORD: " tee-off " } as unknown as NodeJS.ProcessEnv),
    ).toBe("tee-off");
  });

  it("lets in the right password with any username, and nothing else", () => {
    expect(hasSitePassword(basic("sam", "tee-off"), "tee-off")).toBe(true);
    expect(hasSitePassword(basic("", "tee-off"), "tee-off")).toBe(true);
    expect(hasSitePassword(basic("sam", "tee-of"), "tee-off")).toBe(false);
    expect(hasSitePassword(basic("sam", "tee-offf"), "tee-off")).toBe(false);
    expect(hasSitePassword(null, "tee-off")).toBe(false);
    expect(hasSitePassword("Bearer tee-off", "tee-off")).toBe(false);
    expect(hasSitePassword("Basic !!!", "tee-off")).toBe(false);
  });
});

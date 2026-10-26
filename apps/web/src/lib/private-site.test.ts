import { describe, expect, it } from "vitest";
import {
  hasSitePassword,
  sameText,
  sitePassword,
  testerCode,
  testerCookieValue,
} from "./private-site";

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

describe("tester links", () => {
  it("are on only when a code is set", () => {
    expect(testerCode({} as NodeJS.ProcessEnv)).toBeNull();
    expect(testerCode({ BOOKON_TESTER_CODE: " birdie42 " } as unknown as NodeJS.ProcessEnv)).toBe(
      "birdie42",
    );
  });

  it("leave a fingerprint of the code, which changes when the code does", async () => {
    const value = await testerCookieValue("birdie42");
    expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(value).not.toContain("birdie42");
    expect(await testerCookieValue("birdie42")).toBe(value);
    expect(await testerCookieValue("eagle43")).not.toBe(value);
  });

  it("compare codes exactly", () => {
    expect(sameText("birdie42", "birdie42")).toBe(true);
    expect(sameText("birdie4", "birdie42")).toBe(false);
    expect(sameText("", "birdie42")).toBe(false);
  });
});

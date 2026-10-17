import { describe, expect, it } from "vitest";
import { isBot } from "./bots";

describe("isBot", () => {
  it("lets real browsers through", () => {
    expect(
      isBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
    expect(
      isBot(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("catches crawlers, link previews, scripts and empty agents", () => {
    for (const ua of [
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "facebookexternalhit/1.1",
      "WhatsApp/2.23",
      "curl/8.5.0",
      "python-requests/2.32",
      "Mozilla/5.0 HeadlessChrome/141",
      "BookOnBot/0.1",
      "",
      null,
    ]) {
      expect(isBot(ua)).toBe(true);
    }
  });
});

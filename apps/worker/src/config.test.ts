import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("identifies BookOn with info@bookon.au by default", () => {
    expect(loadConfig({}).userAgent).toBe("BookOnBot/0.1 (+https://bookon.au; info@bookon.au)");
  });

  it("takes a different contact from the environment", () => {
    expect(loadConfig({ BOOKON_CONTACT_EMAIL: "ops@bookon.au" }).userAgent).toContain(
      "ops@bookon.au",
    );
  });

  it("obeys rules for Claude-User when Claude Code runs it", () => {
    expect(loadConfig({}).alsoObeyAgents).toEqual([]);
    expect(loadConfig({ CLAUDECODE: "1" }).alsoObeyAgents).toEqual(["Claude-User"]);
  });
});

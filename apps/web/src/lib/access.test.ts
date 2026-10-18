import { describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail } from "./access";

describe("admin emails", () => {
  it("come from BOOKON_ADMIN_EMAILS, any case, comma separated", () => {
    const env = {
      BOOKON_ADMIN_EMAILS: " Sam@Example.com , info@bookon.com.au,,",
    } as unknown as NodeJS.ProcessEnv;
    expect(adminEmails(env)).toEqual(["sam@example.com", "info@bookon.com.au"]);
    expect(isAdminEmail("SAM@example.COM", env)).toBe(true);
    expect(isAdminEmail("someone@example.com", env)).toBe(false);
  });

  it("are nobody when the setting is missing", () => {
    expect(adminEmails({} as unknown as NodeJS.ProcessEnv)).toEqual([]);
    expect(isAdminEmail("sam@example.com", {} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});

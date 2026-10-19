import { describe, expect, it, vi } from "vitest";
import { adminEmail, isAdminEmail } from "./access";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe("the admin", () => {
  it("is the one email in BOOKON_ADMIN_EMAIL, any case", () => {
    const e = env({ BOOKON_ADMIN_EMAIL: " Sam@Example.com " });
    expect(adminEmail(e)).toBe("sam@example.com");
    expect(isAdminEmail("SAM@example.COM", e)).toBe(true);
    expect(isAdminEmail("someone@example.com", e)).toBe(false);
  });

  it("still reads the older BOOKON_ADMIN_EMAILS", () => {
    expect(adminEmail(env({ BOOKON_ADMIN_EMAILS: "sam@example.com," }))).toBe("sam@example.com");
  });

  it("is nobody when more than one address is set", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const e = env({ BOOKON_ADMIN_EMAIL: "sam@example.com, other@example.com" });
    expect(adminEmail(e)).toBeNull();
    expect(isAdminEmail("sam@example.com", e)).toBe(false);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("is nobody when the setting is missing", () => {
    expect(adminEmail(env({}))).toBeNull();
    expect(isAdminEmail("sam@example.com", env({}))).toBe(false);
  });
});

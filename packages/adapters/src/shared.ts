import type { Course } from "@bookon/core";

/** The page loaded but does not look like the platform page we expect. Never treat as "no tee times". */
export class PageFormatError extends Error {
  override name = "PageFormatError";
}

/** The course's `platformConfig` is missing something the adapter needs. */
export class ConfigError extends Error {
  override name = "ConfigError";
}

export function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function readConfig<T>(course: Course, required: (keyof T & string)[]): T {
  const config = course.platformConfig as Partial<T>;
  for (const key of required) {
    if (typeof config[key] !== "string" || config[key] === "") {
      throw new ConfigError(`${course.slug}: platformConfig.${key} is required`);
    }
  }
  return config as T;
}

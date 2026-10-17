import "server-only";
import { cookies } from "next/headers";
import { SESSION_TTL_MS, userForSession, type User } from "@bookon/db";
import { getDb } from "./db";

/** The signed-in device cookie. Holds a random token; the database keeps only its hash. */
export const AUTH_COOKIE = "bookon_auth";

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return userForSession(getDb(), token, new Date());
}

export async function setAuthCookie(token: string) {
  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

export async function authToken(): Promise<string | null> {
  return (await cookies()).get(AUTH_COOKIE)?.value ?? null;
}

export async function clearAuthCookie() {
  (await cookies()).delete(AUTH_COOKIE);
}

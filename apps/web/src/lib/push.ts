import "server-only";
import { vapidKeys } from "@bookon/email";
import { getDb } from "./db";

/** The public half of the push key pair, for browsers to subscribe with. Null if push is off. */
export async function pushPublicKey(): Promise<string | null> {
  try {
    return (await vapidKeys(getDb()))?.publicKey ?? null;
  } catch (error) {
    console.error("[push] could not load push keys", error);
    return null;
  }
}

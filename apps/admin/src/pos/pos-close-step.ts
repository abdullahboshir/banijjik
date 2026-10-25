import type { PosSessionResponse } from "@banijjik/contracts/pos";
import { getCurrentSession } from "./pos-api";

/** What the close screen shows first: the counting form, a message when no register is open, or a failure. */
export type CloseStep =
  | { readonly kind: "loading" }
  | { readonly kind: "noOpen" }
  | { readonly kind: "loadFailed" }
  | { readonly kind: "count"; readonly session: PosSessionResponse };

/**
 * Reads the open register again, so the close carries its current version: a sale made after the
 * till opened bumps the session version (plan 3.9 decision 6).
 */
export async function loadCloseStep(organizationId: string): Promise<CloseStep> {
  try {
    const session = await getCurrentSession(organizationId);
    if (session === null) return { kind: "noOpen" };
    return { kind: "count", session };
  } catch {
    return { kind: "loadFailed" };
  }
}

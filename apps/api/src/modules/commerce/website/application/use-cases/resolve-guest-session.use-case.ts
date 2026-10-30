import { createHash, timingSafeEqual } from "node:crypto";
import type { GuestSessionEntity } from "@banijjik/contracts/website";
import type { Clock } from "../../../../../kernel/time/index.js";
import { isGuestSessionExpired } from "../../domain/guest-session.entity.js";
import type { GuestSessionRepository } from "../ports/guest-session-repository.port.js";

export function hashGuestSecret(rawSecret: string): string {
  return createHash("sha256").update(rawSecret, "utf8").digest("hex");
}

export function verifyGuestSecret(rawSecret: string, storedHash: string): boolean {
  if (!rawSecret || !storedHash) return false;
  const computed = hashGuestSecret(rawSecret);
  const computedBuf = Buffer.from(computed, "hex");
  const storedBuf = Buffer.from(storedHash, "hex");
  if (computedBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(computedBuf, storedBuf);
}

export interface ResolveGuestSessionInput {
  readonly organizationId: string;
  readonly guestSessionId: string;
  readonly rawSecret: string;
}

export type ResolveGuestSessionOutcome =
  | { readonly kind: "VALID"; readonly session: GuestSessionEntity }
  | { readonly kind: "EXPIRED"; readonly session: GuestSessionEntity }
  | { readonly kind: "CROSS_ORG" }
  | { readonly kind: "INVALID" };

export class ResolveGuestSessionUseCase {
  constructor(
    private readonly repository: GuestSessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ResolveGuestSessionInput): Promise<ResolveGuestSessionOutcome> {
    const { organizationId, guestSessionId, rawSecret } = input;

    const session = await this.repository.findBySessionId(guestSessionId);
    if (!session) {
      return { kind: "INVALID" };
    }

    if (session.organizationId !== organizationId) {
      return { kind: "CROSS_ORG" };
    }

    if (!verifyGuestSecret(rawSecret, session.secretHash)) {
      return { kind: "INVALID" };
    }

    const now = this.clock.now();
    if (isGuestSessionExpired(session.expiresAt, now)) {
      return { kind: "EXPIRED", session };
    }

    return { kind: "VALID", session };
  }
}

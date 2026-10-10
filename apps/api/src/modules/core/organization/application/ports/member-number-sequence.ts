import type { OrganizationId } from "@banijjik/ids";

/** The per-organization MEMBER counter (ADR-085: FAST, so a number can be lost but never repeats). */
export interface MemberNumberSequence {
  next(organizationId: OrganizationId): Promise<number>;
}

import type { ListingStatus } from "@banijjik/contracts/directory";
import type { OrganizationId } from "@banijjik/ids";

/** The two review results a customer is told about (M.8b). */
export type ListingReviewOutcome = Extract<ListingStatus, "APPROVED" | "REJECTED">;

/**
 * Writes the SMS in the business's own language. The reasons are template labels; the staff note is
 * deliberately not part of the input, so it can never leak into a message (M.8b decision 4).
 */
export interface ReviewResultMessageComposer {
  compose(input: {
    readonly organizationId: OrganizationId;
    readonly outcome: ListingReviewOutcome;
    readonly listingNumber: string;
    readonly reasonKeys: readonly string[];
  }): Promise<string>;
}

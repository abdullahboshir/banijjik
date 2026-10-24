import type { Money } from "@banijjik/contracts/accounting";

/**
 * What the enrollment period posting needs (card 3.31). `heldAdvance` is read by the enrollment
 * side with the payment advance reader, so accounting never imports the payment module.
 */
export interface EnrollmentPeriodPostingSnapshot {
  readonly enrollmentPeriodId: string;
  readonly locationId: string | null;
  readonly fee: Money;
  readonly heldAdvance: Money;
  /** Business date the period's revenue was recognised (set once). */
  readonly revenueRecognizedOn?: string | undefined;
  /** Cancel business date of a cancelled enrollment (its endsOn). */
  readonly cancelledOn?: string | undefined;
}

export interface EnrollmentPeriodPostingSource {
  readPeriod(input: {
    readonly organizationId: string;
    readonly enrollmentPeriodId: string;
  }): Promise<EnrollmentPeriodPostingSnapshot | undefined>;
}

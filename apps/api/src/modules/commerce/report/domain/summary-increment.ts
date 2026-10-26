import type { ReportCounter, ReportMethodCounter } from "@banijjik/contracts/report";

/** One event's effect on one daily row: counter deltas and at most one method-keyed delta. */
export interface SummaryIncrement {
  readonly locationId: string;
  readonly businessDate: string;
  readonly counterDeltas: Readonly<Partial<Record<ReportCounter, number>>>;
  readonly methodDelta?: MethodDelta | undefined;
}

export interface MethodDelta {
  readonly field: ReportMethodCounter;
  readonly method: string;
  readonly amount: number;
}

import type { RiderHandoverPostingSnapshot } from "../../domain/settlement-posting-rules.js";

export interface RiderHandoverPostingSource {
  readRiderHandover(riderCashHandoverId: string): Promise<RiderHandoverPostingSnapshot | undefined>;
}

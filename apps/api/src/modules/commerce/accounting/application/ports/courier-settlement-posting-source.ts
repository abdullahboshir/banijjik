import type { CourierSettlementPostingSnapshot } from "../../domain/settlement-posting-rules.js";

export interface CourierSettlementPostingSource {
  readCourierSettlement(
    courierSettlementId: string,
  ): Promise<CourierSettlementPostingSnapshot | undefined>;
}

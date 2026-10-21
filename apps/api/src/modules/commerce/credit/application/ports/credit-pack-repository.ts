import type { OrganizationId } from "@banijjik/ids";
import type { CreditPack } from "../../domain/index.js";

export interface CreditPackRepository {
  insert(pack: CreditPack): Promise<void>;
  save(pack: CreditPack, expectedVersion: number, actorUserId: string | null): Promise<CreditPack>;
  findById(organizationId: OrganizationId, creditPackId: string): Promise<CreditPack | null>;
  listActive(organizationId: OrganizationId): Promise<readonly CreditPack[]>;
  list(
    organizationId: OrganizationId,
    options: { limit: number; offset: number },
  ): Promise<{ readonly items: readonly CreditPack[]; readonly total: number }>;
}

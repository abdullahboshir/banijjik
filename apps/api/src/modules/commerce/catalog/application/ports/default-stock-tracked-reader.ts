import type { OrganizationId } from "@banijjik/ids";

export interface DefaultStockTrackedReader {
  read(organizationId: OrganizationId): Promise<boolean>;
}

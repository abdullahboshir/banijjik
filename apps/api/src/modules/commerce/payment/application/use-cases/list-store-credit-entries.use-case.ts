import type { StoreCreditEntryResponse } from "@banijjik/contracts/payment";
import type { ContactId, OrganizationId } from "@banijjik/ids";
import type {
  ContactStoreCreditPort,
  ListStoreCreditFilter,
  PaginatedResult,
  StoreCreditRepository,
} from "../ports/payment-repositories.js";
import { toStoreCreditEntryResponse } from "./adjust-store-credit.use-case.js";

export class ListStoreCreditEntriesUseCase {
  constructor(
    private readonly dependencies: {
      readonly storeCredit: StoreCreditRepository;
      readonly contactStoreCredit: ContactStoreCreditPort;
    },
  ) {}

  async execute(filter: ListStoreCreditFilter): Promise<
    PaginatedResult<StoreCreditEntryResponse> & {
      readonly balanceMinor: number;
    }
  > {
    const [entries, contactBal] = await Promise.all([
      this.dependencies.storeCredit.listByContact(filter),
      this.dependencies.contactStoreCredit.getBalance(filter.organizationId, filter.contactId),
    ]);

    return {
      items: entries.items.map(toStoreCreditEntryResponse),
      total: entries.total,
      page: entries.page,
      limit: entries.limit,
      balanceMinor: contactBal?.balanceMinor ?? 0,
    };
  }

  async getBalance(organizationId: OrganizationId, contactId: ContactId): Promise<number> {
    const contactBal = await this.dependencies.contactStoreCredit.getBalance(
      organizationId,
      contactId,
    );
    return contactBal?.balanceMinor ?? 0;
  }
}

import type {
  CommissionEntryResponse,
  CommissionMemberSummaryResponse,
} from "@banijjik/contracts/commission";
import type { Money } from "@banijjik/contracts/accounting";
import type { OrganizationId } from "@banijjik/ids";
import type {
  CommissionEntryListQuery,
  CommissionMyEntriesQuery,
  CommissionSummaryQuery,
} from "@banijjik/validation/commission";
import { locationForbidden } from "../../domain/errors.js";
import { toEntryResponse } from "../commission-views.js";
import type {
  CommissionEntryRepository,
  CommissionMemberNameReader,
  CommissionReferenceReader,
} from "../ports/commission-ports.js";

type AllowedLocations = readonly string[] | "ALL";

export interface EntryReadDependencies {
  readonly entries: CommissionEntryRepository;
  readonly memberNames: CommissionMemberNameReader;
  readonly references: Pick<CommissionReferenceReader, "organizationCurrency">;
}

export interface EntryPage {
  readonly items: readonly CommissionEntryResponse[];
  readonly hasNext: boolean;
}

/** The `?location=` filter must be one of the caller's locations; the tenant plugin narrows the rest. */
function assertLocationAllowed(locationId: string | undefined, allowed: AllowedLocations): void {
  if (locationId === undefined || allowed === "ALL") return;
  if (!allowed.includes(locationId)) throw locationForbidden();
}

async function joinPage(
  dependencies: EntryReadDependencies,
  page: Awaited<ReturnType<CommissionEntryRepository["list"]>>,
): Promise<EntryPage> {
  const memberIds = [...new Set(page.items.map((entry) => entry.memberId))];
  const memberNames = await dependencies.memberNames.readNames(memberIds);
  return {
    items: page.items.map((entry) => toEntryResponse(entry, memberNames)),
    hasNext: page.hasNext,
  };
}

export class ListCommissionEntriesUseCase {
  constructor(private readonly dependencies: EntryReadDependencies) {}

  async execute(input: {
    readonly query: CommissionEntryListQuery;
    readonly allowedLocationIds: AllowedLocations;
  }): Promise<EntryPage> {
    const { query } = input;
    assertLocationAllowed(query.location, input.allowedLocationIds);
    const page = await this.dependencies.entries.list({
      memberId: query.memberId,
      locationId: query.location,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });
    return joinPage(this.dependencies, page);
  }
}

/** The caller's own entries: the member comes from the session, never from the query. */
export class ListMyCommissionEntriesUseCase {
  constructor(private readonly dependencies: EntryReadDependencies) {}

  async execute(input: {
    readonly memberId: string;
    readonly query: CommissionMyEntriesQuery;
  }): Promise<EntryPage> {
    const page = await this.dependencies.entries.list({
      memberId: input.memberId,
      from: input.query.from,
      to: input.query.to,
      page: input.query.page,
      limit: input.query.limit,
    });
    return joinPage(this.dependencies, page);
  }
}

export class GetCommissionSummaryUseCase {
  constructor(private readonly dependencies: EntryReadDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly query: CommissionSummaryQuery;
    readonly allowedLocationIds: AllowedLocations;
  }): Promise<{
    readonly items: readonly CommissionMemberSummaryResponse[];
    readonly hasNext: boolean;
  }> {
    const { query } = input;
    assertLocationAllowed(query.location, input.allowedLocationIds);
    const currency = await this.dependencies.references.organizationCurrency(input.organizationId);
    const page = await this.dependencies.entries.summarizeByMember({
      locationId: query.location,
      currency,
      page: query.page,
      limit: query.limit,
    });
    const names = await this.dependencies.memberNames.readNames(
      page.items.map((row) => row.memberId),
    );
    const money = (amount: number): Money => ({ amount, currency });
    return {
      items: page.items.map((row) => ({
        memberId: row.memberId,
        memberName: names.get(row.memberId) ?? "",
        open: money(row.open),
        paidTotal: money(row.paid),
      })),
      hasNext: page.hasNext,
    };
  }
}

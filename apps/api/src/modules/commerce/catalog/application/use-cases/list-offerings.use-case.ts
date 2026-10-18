import type { OfferingKind } from "@banijjik/contracts";
import {
  OFFERING_STATUS,
  type OfferingListItem,
  type OfferingStatus,
} from "@banijjik/contracts/catalog";
import type { CatalogDependencies } from "../catalog-dependencies.js";
import { locationRowsOf, toOfferingListItem } from "../offering-list-view.js";
import { buildOfferingSearch } from "../offering-search.js";
import type { Page } from "../ports/offering-repository.js";

export interface ListOfferingsInput {
  /** The typed term: a name prefix, a synonym, an exact SKU or an exact barcode. */
  readonly q?: string | undefined;
  readonly kind?: OfferingKind | undefined;
  /** Without a status the list shows DRAFT and ACTIVE offerings. */
  readonly status?: OfferingStatus | undefined;
  readonly categoryId?: string | undefined;
  /** The page filter `?location=`; already checked against the caller's locations by the pipeline. */
  readonly location?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

const DEFAULT_STATUSES: readonly OfferingStatus[] = [OFFERING_STATUS.DRAFT, OFFERING_STATUS.ACTIVE];

export type ListOfferingsDependencies = Pick<
  CatalogDependencies,
  "offerings" | "synonyms" | "locationRows"
>;

/**
 * A page of lean rows, newest change first. With `location` each row carries the price and the
 * availability for that location (one batched read of the location's rows, no N+1).
 */
export class ListOfferingsUseCase {
  constructor(private readonly dependencies: ListOfferingsDependencies) {}

  async execute(input: ListOfferingsInput): Promise<Page<OfferingListItem>> {
    const { offerings, synonyms, locationRows } = this.dependencies;
    const search =
      input.q === undefined ? undefined : buildOfferingSearch(input.q, await synonyms.read());
    const page = await offerings.list({
      statuses: input.status === undefined ? DEFAULT_STATUSES : [input.status],
      page: input.page,
      limit: input.limit,
      ...(search === undefined ? {} : { search }),
      ...(input.kind === undefined ? {} : { kind: input.kind }),
      ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
    });
    const location =
      input.location === undefined
        ? undefined
        : locationRowsOf(
            await locationRows.forLocation(
              page.items.map((row) => row.offeringId),
              input.location,
            ),
          );
    return {
      items: page.items.map((row) => toOfferingListItem(row, location)),
      hasNext: page.hasNext,
    };
  }
}

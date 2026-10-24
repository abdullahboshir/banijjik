import {
  newId,
  type CustomerAccountId,
  type ListingBlockId,
  type ListingId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";

export interface ListingBlockProps {
  readonly listingBlockId: ListingBlockId;
  readonly organizationId: OrganizationId;
  readonly customerAccountId: CustomerAccountId;
  readonly listingId: ListingId;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface NewListingBlockInput {
  readonly organizationId: OrganizationId;
  readonly customerAccountId: CustomerAccountId;
  readonly listingId: ListingId;
  readonly now: Date;
}

/** A customer's block of a listing to hide it from own search (card M.7, ADR-134). */
export class ListingBlock implements ListingBlockProps {
  readonly listingBlockId: ListingBlockId;
  readonly organizationId: OrganizationId;
  readonly customerAccountId: CustomerAccountId;
  readonly listingId: ListingId;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;

  constructor(props: ListingBlockProps) {
    this.listingBlockId = props.listingBlockId;
    this.organizationId = props.organizationId;
    this.customerAccountId = props.customerAccountId;
    this.listingId = props.listingId;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static create(input: NewListingBlockInput): ListingBlock {
    return new ListingBlock({
      listingBlockId: newId(),
      organizationId: input.organizationId,
      customerAccountId: input.customerAccountId,
      listingId: input.listingId,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: null,
      updatedByUserId: null,
    });
  }
}

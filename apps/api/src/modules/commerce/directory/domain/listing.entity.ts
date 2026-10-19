import {
  LISTING_STATUS,
  type ListingConsentAccepted,
  type ListingRejection,
  type ListingStatus,
} from "@banijjik/contracts/directory";
import {
  newId,
  type CustomerAccountId,
  type ListingId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { finalRejection, invalidListingTransition } from "./errors.js";

export interface ListingSearchEntry {
  readonly fieldKey: string;
  readonly value: string;
}

export interface ListingProps {
  readonly listingId: ListingId;
  readonly organizationId: OrganizationId;
  readonly listingNumber: string;
  readonly ownerCustomerAccountId: CustomerAccountId;
  readonly status: ListingStatus;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly customFieldSearch: readonly ListingSearchEntry[];
  readonly photoFileIds: readonly string[];
  readonly consentsAccepted: readonly ListingConsentAccepted[];
  readonly submittedAt: Date | undefined;
  readonly reviewedAt: Date | undefined;
  readonly reviewedByUserId: UserId | undefined;
  readonly rejection: ListingRejection | undefined;
  readonly publishedAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface NewListingInput {
  readonly organizationId: OrganizationId;
  readonly listingNumber: string;
  readonly ownerCustomerAccountId: CustomerAccountId;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly customFieldSearch: readonly ListingSearchEntry[];
  readonly photoFileIds: readonly string[];
  readonly createdByUserId: UserId | null;
  readonly now: Date;
}

export interface ListingDataChanges {
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly customFieldSearch: readonly ListingSearchEntry[];
  readonly photoFileIds: readonly string[];
}

const EDITABLE_STATUSES = new Set<ListingStatus>([
  LISTING_STATUS.DRAFT,
  LISTING_STATUS.REJECTED,
  LISTING_STATUS.APPROVED,
]);

/** A customer-submitted directory listing (doc 16 §3.1, ADR-127). */
export class Listing implements ListingProps {
  readonly listingId: ListingId;
  readonly organizationId: OrganizationId;
  readonly listingNumber: string;
  readonly ownerCustomerAccountId: CustomerAccountId;
  readonly status: ListingStatus;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly customFieldSearch: readonly ListingSearchEntry[];
  readonly photoFileIds: readonly string[];
  readonly consentsAccepted: readonly ListingConsentAccepted[];
  readonly submittedAt: Date | undefined;
  readonly reviewedAt: Date | undefined;
  readonly reviewedByUserId: UserId | undefined;
  readonly rejection: ListingRejection | undefined;
  readonly publishedAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;

  private constructor(props: ListingProps) {
    this.listingId = props.listingId;
    this.organizationId = props.organizationId;
    this.listingNumber = props.listingNumber;
    this.ownerCustomerAccountId = props.ownerCustomerAccountId;
    this.status = props.status;
    this.customFields = props.customFields;
    this.customFieldSearch = props.customFieldSearch;
    this.photoFileIds = props.photoFileIds;
    this.consentsAccepted = props.consentsAccepted;
    this.submittedAt = props.submittedAt;
    this.reviewedAt = props.reviewedAt;
    this.reviewedByUserId = props.reviewedByUserId;
    this.rejection = props.rejection;
    this.publishedAt = props.publishedAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static create(input: NewListingInput): Listing {
    return new Listing({
      listingId: newId<ListingId>(),
      organizationId: input.organizationId,
      listingNumber: input.listingNumber,
      ownerCustomerAccountId: input.ownerCustomerAccountId,
      status: LISTING_STATUS.DRAFT,
      customFields: input.customFields,
      customFieldSearch: input.customFieldSearch,
      photoFileIds: input.photoFileIds,
      consentsAccepted: [],
      submittedAt: undefined,
      reviewedAt: undefined,
      reviewedByUserId: undefined,
      rejection: undefined,
      publishedAt: undefined,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
      updatedByUserId: input.createdByUserId,
    });
  }

  static restore(props: ListingProps): Listing {
    return new Listing(props);
  }

  /** Replaces draft/rejected/approved data. Approved may return to SUBMITTED when reviewEdits is on. */
  withOwnerData(
    changes: ListingDataChanges,
    now: Date,
    options: { readonly reviewEdits: boolean; readonly finalReasonKeys: ReadonlySet<string> },
  ): Listing {
    if (this.status === LISTING_STATUS.ARCHIVED) {
      throw invalidListingTransition(this.status);
    }
    if (!EDITABLE_STATUSES.has(this.status)) {
      throw invalidListingTransition(this.status);
    }
    if (
      this.status === LISTING_STATUS.REJECTED &&
      this.hasFinalRejection(options.finalReasonKeys)
    ) {
      throw finalRejection();
    }
    const nextStatus =
      this.status === LISTING_STATUS.APPROVED && options.reviewEdits
        ? LISTING_STATUS.SUBMITTED
        : this.status;
    return new Listing({
      ...this.snapshot(),
      customFields: changes.customFields,
      customFieldSearch: changes.customFieldSearch,
      photoFileIds: changes.photoFileIds,
      status: nextStatus,
      submittedAt:
        nextStatus === LISTING_STATUS.SUBMITTED && this.status === LISTING_STATUS.APPROVED
          ? now
          : this.submittedAt,
      publishedAt: nextStatus === LISTING_STATUS.SUBMITTED ? undefined : this.publishedAt,
      updatedAt: now,
      updatedByUserId: null,
    });
  }

  submit(
    consents: readonly ListingConsentAccepted[],
    now: Date,
    finalReasonKeys: ReadonlySet<string>,
  ): Listing {
    if (this.status === LISTING_STATUS.REJECTED && this.hasFinalRejection(finalReasonKeys)) {
      throw finalRejection();
    }
    if (this.status !== LISTING_STATUS.DRAFT && this.status !== LISTING_STATUS.REJECTED) {
      throw invalidListingTransition(this.status);
    }
    return new Listing({
      ...this.snapshot(),
      status: LISTING_STATUS.SUBMITTED,
      consentsAccepted: consents,
      submittedAt: now,
      rejection: undefined,
      reviewedAt: undefined,
      reviewedByUserId: undefined,
      updatedAt: now,
      updatedByUserId: null,
    });
  }

  approve(now: Date, reviewerUserId: UserId): Listing {
    if (this.status !== LISTING_STATUS.SUBMITTED) throw invalidListingTransition(this.status);
    return new Listing({
      ...this.snapshot(),
      status: LISTING_STATUS.APPROVED,
      reviewedAt: now,
      reviewedByUserId: reviewerUserId,
      rejection: undefined,
      publishedAt: now,
      updatedAt: now,
      updatedByUserId: reviewerUserId,
    });
  }

  reject(rejection: ListingRejection, now: Date, reviewerUserId: UserId): Listing {
    if (this.status !== LISTING_STATUS.SUBMITTED) throw invalidListingTransition(this.status);
    return new Listing({
      ...this.snapshot(),
      status: LISTING_STATUS.REJECTED,
      reviewedAt: now,
      reviewedByUserId: reviewerUserId,
      rejection,
      publishedAt: undefined,
      updatedAt: now,
      updatedByUserId: reviewerUserId,
    });
  }

  hide(now: Date, actorUserId: UserId): Listing {
    if (this.status !== LISTING_STATUS.APPROVED) throw invalidListingTransition(this.status);
    return new Listing({
      ...this.snapshot(),
      status: LISTING_STATUS.HIDDEN,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }

  unhide(now: Date, actorUserId: UserId): Listing {
    if (this.status !== LISTING_STATUS.HIDDEN) throw invalidListingTransition(this.status);
    return new Listing({
      ...this.snapshot(),
      status: LISTING_STATUS.APPROVED,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }

  /** Owner delete: clear personal data, keep the listing number (3.1a anonymize semantics). */
  archive(now: Date): Listing {
    if (this.status === LISTING_STATUS.ARCHIVED) throw invalidListingTransition(this.status);
    return new Listing({
      ...this.snapshot(),
      status: LISTING_STATUS.ARCHIVED,
      customFields: {},
      customFieldSearch: [],
      photoFileIds: [],
      consentsAccepted: [],
      rejection: undefined,
      updatedAt: now,
      updatedByUserId: null,
    });
  }

  hasFinalRejection(finalReasonKeys: ReadonlySet<string>): boolean {
    const reasons = this.rejection?.reasonKeys ?? [];
    return reasons.some((key) => finalReasonKeys.has(key));
  }

  private snapshot(): ListingProps {
    return {
      listingId: this.listingId,
      organizationId: this.organizationId,
      listingNumber: this.listingNumber,
      ownerCustomerAccountId: this.ownerCustomerAccountId,
      status: this.status,
      customFields: this.customFields,
      customFieldSearch: this.customFieldSearch,
      photoFileIds: this.photoFileIds,
      consentsAccepted: this.consentsAccepted,
      submittedAt: this.submittedAt,
      reviewedAt: this.reviewedAt,
      reviewedByUserId: this.reviewedByUserId,
      rejection: this.rejection,
      publishedAt: this.publishedAt,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
    };
  }
}

import {
  LISTING_FIELD_TIER,
  LISTING_STATUS,
  LISTING_VIEWER,
  type ListingListItem,
  type ListingResponse,
  type ListingViewer,
  type StaffListingListItem,
} from "@banijjik/contracts/directory";
import type { DirectoryPhotoPolicy } from "@banijjik/contracts/directory";
import type { CustomFieldRule } from "@banijjik/validation";
import type { Listing } from "../domain/listing.entity.js";
import { projectListingFields, projectListingPhotos } from "../domain/project-listing.js";

interface ListingViewInput {
  readonly listing: Listing;
  readonly fields: readonly CustomFieldRule[];
  readonly viewer: ListingViewer;
  readonly photoPolicy: DirectoryPhotoPolicy;
}

export function toListingResponse(input: ListingViewInput): ListingResponse {
  const { listing, fields, viewer, photoPolicy } = input;
  return {
    listingId: listing.listingId,
    listingNumber: listing.listingNumber,
    ownerCustomerAccountId: listing.ownerCustomerAccountId,
    status: listing.status,
    customFields: projectListingFields(listing.customFields, fields, viewer),
    photoFileIds: [
      ...projectListingPhotos({
        photoFileIds: listing.photoFileIds,
        photoPolicy,
        viewer,
      }),
    ],
    consentsAccepted: [...listing.consentsAccepted],
    submittedAt: listing.submittedAt?.toISOString() ?? null,
    reviewedAt: listing.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: listing.reviewedByUserId ?? null,
    rejection: listing.rejection ?? null,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    version: listing.version,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export function toListingListItem(input: ListingViewInput): ListingListItem {
  const { listing, fields, viewer, photoPolicy } = input;
  return {
    listingId: listing.listingId,
    listingNumber: listing.listingNumber,
    customFields: projectListingFields(listing.customFields, fields, viewer),
    photoFileIds: [
      ...projectListingPhotos({
        photoFileIds: listing.photoFileIds,
        photoPolicy,
        viewer,
      }),
    ],
    publishedAt: listing.publishedAt?.toISOString() ?? listing.updatedAt.toISOString(),
  };
}

/**
 * Staff all-listings row: PUBLIC fields of the template's first section only (ADR-129).
 * Never carries PRIVATE or UNLOCKED values.
 */
export function toStaffListingListItem(input: {
  readonly listing: Listing;
  readonly fields: readonly CustomFieldRule[];
  readonly firstSectionKey: string | undefined;
}): StaffListingListItem {
  const { listing, fields, firstSectionKey } = input;
  const sectionFields =
    firstSectionKey === undefined
      ? []
      : fields.filter(
          (field) =>
            field.sectionKey === firstSectionKey &&
            (field.listingTier ?? LISTING_FIELD_TIER.PUBLIC) === LISTING_FIELD_TIER.PUBLIC,
        );
  return {
    listingId: listing.listingId,
    listingNumber: listing.listingNumber,
    status: listing.status,
    submittedAt: listing.submittedAt?.toISOString() ?? null,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    editedAfterApproval:
      listing.status === LISTING_STATUS.SUBMITTED && listing.reviewedAt !== undefined,
    customFields: projectListingFields(listing.customFields, sectionFields, LISTING_VIEWER.PUBLIC),
  };
}

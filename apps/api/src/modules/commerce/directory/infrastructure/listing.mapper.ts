import {
  asId,
  type CustomerAccountId,
  type ListingId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { Listing } from "../domain/listing.entity.js";
import type { ListingDocument } from "./listing.schema.js";

function withoutEmpty<Value>(value: Value | null | undefined): Value | undefined {
  if (value === null || value === undefined) return undefined;
  return value;
}

export function toListingDocument(listing: Listing): ListingDocument {
  return {
    listingId: listing.listingId,
    organizationId: listing.organizationId,
    listingNumber: listing.listingNumber,
    ownerCustomerAccountId: listing.ownerCustomerAccountId,
    status: listing.status,
    customFields: { ...listing.customFields },
    customFieldSearch: [...listing.customFieldSearch],
    photoFileIds: [...listing.photoFileIds],
    consentsAccepted: listing.consentsAccepted.map((consent) => ({
      consentKey: consent.consentKey,
      textVersionHash: consent.textVersionHash,
      acceptedAt: new Date(consent.acceptedAt),
    })),
    ...(listing.submittedAt === undefined ? {} : { submittedAt: listing.submittedAt }),
    ...(listing.reviewedAt === undefined ? {} : { reviewedAt: listing.reviewedAt }),
    ...(listing.reviewedByUserId === undefined
      ? {}
      : { reviewedByUserId: listing.reviewedByUserId }),
    ...(listing.rejection === undefined
      ? {}
      : {
          rejection: {
            reasonKeys: [...listing.rejection.reasonKeys],
            ...(listing.rejection.note === undefined ? {} : { note: listing.rejection.note }),
          },
        }),
    ...(listing.publishedAt === undefined ? {} : { publishedAt: listing.publishedAt }),
    version: listing.version,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    createdByUserId: listing.createdByUserId,
    updatedByUserId: listing.updatedByUserId,
  };
}

export function toListing(document: ListingDocument): Listing {
  const stored = stripMongoInternals(document);
  return Listing.restore({
    listingId: asId<ListingId>(stored.listingId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    listingNumber: stored.listingNumber,
    ownerCustomerAccountId: asId<CustomerAccountId>(stored.ownerCustomerAccountId),
    status: stored.status,
    customFields: stored.customFields ?? {},
    customFieldSearch: stored.customFieldSearch ?? [],
    photoFileIds: stored.photoFileIds ?? [],
    consentsAccepted: (stored.consentsAccepted ?? []).map((consent) => ({
      consentKey: consent.consentKey,
      textVersionHash: consent.textVersionHash,
      acceptedAt: consent.acceptedAt.toISOString(),
    })),
    submittedAt: withoutEmpty(stored.submittedAt),
    reviewedAt: withoutEmpty(stored.reviewedAt),
    reviewedByUserId:
      stored.reviewedByUserId === undefined || stored.reviewedByUserId === null
        ? undefined
        : asId<UserId>(stored.reviewedByUserId),
    rejection: withoutEmpty(stored.rejection),
    publishedAt: withoutEmpty(stored.publishedAt),
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: stored.createdByUserId === null ? null : asId<UserId>(stored.createdByUserId),
    updatedByUserId: stored.updatedByUserId === null ? null : asId<UserId>(stored.updatedByUserId),
  });
}

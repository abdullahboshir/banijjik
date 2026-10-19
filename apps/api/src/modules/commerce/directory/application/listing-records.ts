import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  REDACTED_AUDIT_VALUE,
  type AuditAction,
  type AuditChanges,
} from "@banijjik/contracts";
import {
  DIRECTORY_EVENT_TYPE,
  type DirectoryEventType,
  type ListingEventPayload,
} from "@banijjik/contracts/directory";
import type { Listing } from "../domain/listing.entity.js";
import type { DirectoryDependencies } from "./directory-dependencies.js";

function payloadOf(listing: Listing): ListingEventPayload {
  return {
    listingId: listing.listingId,
    listingNumber: listing.listingNumber,
    ownerCustomerAccountId: listing.ownerCustomerAccountId,
    status: listing.status,
  };
}

function auditChanges(before: Listing | undefined, after: Listing): AuditChanges {
  const changes: Record<string, { from?: string; to?: string }> = {
    status: {
      ...(before === undefined ? {} : { from: before.status }),
      to: after.status,
    },
  };
  const keys = new Set([
    ...Object.keys(before?.customFields ?? {}),
    ...Object.keys(after.customFields),
  ]);
  for (const key of keys) {
    const from = before?.customFields[key];
    const to = after.customFields[key];
    if (from === to) continue;
    changes[key] = {
      ...(from === undefined ? {} : { from: REDACTED_AUDIT_VALUE }),
      ...(to === undefined ? {} : { to: REDACTED_AUDIT_VALUE }),
    };
  }
  return changes;
}

export async function recordListingChange(
  dependencies: DirectoryDependencies,
  input: {
    readonly action: AuditAction;
    readonly before: Listing | undefined;
    readonly after: Listing;
    readonly eventType: DirectoryEventType;
  },
): Promise<void> {
  await dependencies.audit.record({
    action: input.action,
    entityType: AUDIT_ENTITY_TYPE.listing,
    entityId: input.after.listingId,
    changes: auditChanges(input.before, input.after),
  });
  await dependencies.events.publish(input.eventType, payloadOf(input.after), {
    orderingKey: `listing:${input.after.listingId}`,
  });
}

export { AUDIT_ACTION, DIRECTORY_EVENT_TYPE };

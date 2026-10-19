import { AUDIT_ACTION } from "@banijjik/contracts";
import {
  DIRECTORY_EVENT_TYPE,
  LISTING_VIEWER,
  type ListingRejectRequest,
  type ListingResponse,
} from "@banijjik/contracts/directory";
import type { ListingId, OrganizationId, UserId } from "@banijjik/ids";
import { invalidField, listingNotFound } from "../../domain/errors.js";
import type { DirectoryDependencies } from "../directory-dependencies.js";
import { asListingFieldRules } from "../ports/directory-context-ports.js";
import { toListingResponse } from "../listing-view.js";
import { recordListingChange } from "../listing-records.js";

async function staffView(
  dependencies: DirectoryDependencies,
  organizationId: OrganizationId,
  listing: import("../../domain/listing.entity.js").Listing,
): Promise<ListingResponse> {
  const [effective, photoPolicy] = await Promise.all([
    dependencies.fields.forOrganization(organizationId),
    dependencies.settings.photoPolicy(organizationId),
  ]);
  return toListingResponse({
    listing,
    fields: asListingFieldRules(effective),
    viewer: LISTING_VIEWER.STAFF,
    photoPolicy,
  });
}

export class ListDirectoryQueueUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly status?: "SUBMITTED" | "APPROVED" | "REJECTED" | "HIDDEN";
    readonly page: number;
    readonly limit: number;
  }): Promise<{
    readonly items: ListingResponse[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
  }> {
    const page = await this.dependencies.listings.listQueue({
      ...(input.status === undefined ? {} : { status: input.status }),
      page: input.page,
      limit: input.limit,
    });
    const items = await Promise.all(
      page.items.map((listing) => staffView(this.dependencies, input.organizationId, listing)),
    );
    return { items, total: page.total, page: page.page, limit: page.limit };
  }
}

export class GetStaffListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingId: ListingId;
  }): Promise<ListingResponse & { readonly reviewChecklist: readonly string[] }> {
    const listing = await this.dependencies.listings.findById(input.listingId);
    if (listing === undefined) throw listingNotFound();
    const directory = await this.dependencies.template.directoryBlockOf(input.organizationId);
    return {
      ...(await staffView(this.dependencies, input.organizationId, listing)),
      reviewChecklist: (directory?.sections ?? []).map((section) => section.sectionKey),
    };
  }
}

export class ApproveListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingId: ListingId;
    readonly version: number;
    readonly actorUserId: UserId;
  }): Promise<ListingResponse> {
    const { listings, unitOfWork, clock } = this.dependencies;
    const saved = await unitOfWork.run(async () => {
      const existing = await listings.findById(input.listingId);
      if (existing === undefined) throw listingNotFound();
      const next = existing.approve(clock.now(), input.actorUserId);
      const persisted = await listings.save(next, input.version, input.actorUserId);
      await recordListingChange(this.dependencies, {
        action: AUDIT_ACTION.LISTING_APPROVED,
        before: existing,
        after: persisted,
        eventType: DIRECTORY_EVENT_TYPE.LISTING_APPROVED,
      });
      return persisted;
    });
    return staffView(this.dependencies, input.organizationId, saved);
  }
}

export class RejectListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingId: ListingId;
    readonly body: ListingRejectRequest;
    readonly actorUserId: UserId;
  }): Promise<ListingResponse> {
    const directory = await this.dependencies.template.directoryBlockOf(input.organizationId);
    const known = new Set((directory?.rejectionReasons ?? []).map((reason) => reason.reasonKey));
    if (input.body.reasonKeys.some((key) => !known.has(key))) {
      throw invalidField("reasonKeys", "validation.invalid_value");
    }
    const { listings, unitOfWork, clock } = this.dependencies;
    const saved = await unitOfWork.run(async () => {
      const existing = await listings.findById(input.listingId);
      if (existing === undefined) throw listingNotFound();
      const next = existing.reject(
        {
          reasonKeys: input.body.reasonKeys,
          ...(input.body.note === undefined ? {} : { note: input.body.note }),
        },
        clock.now(),
        input.actorUserId,
      );
      const persisted = await listings.save(next, input.body.version, input.actorUserId);
      await recordListingChange(this.dependencies, {
        action: AUDIT_ACTION.LISTING_REJECTED,
        before: existing,
        after: persisted,
        eventType: DIRECTORY_EVENT_TYPE.LISTING_REJECTED,
      });
      return persisted;
    });
    return staffView(this.dependencies, input.organizationId, saved);
  }
}

export class HideListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingId: ListingId;
    readonly version: number;
    readonly actorUserId: UserId;
  }): Promise<ListingResponse> {
    const { listings, unitOfWork, clock } = this.dependencies;
    const saved = await unitOfWork.run(async () => {
      const existing = await listings.findById(input.listingId);
      if (existing === undefined) throw listingNotFound();
      const next = existing.hide(clock.now(), input.actorUserId);
      const persisted = await listings.save(next, input.version, input.actorUserId);
      await recordListingChange(this.dependencies, {
        action: AUDIT_ACTION.LISTING_CONCEALED,
        before: existing,
        after: persisted,
        eventType: DIRECTORY_EVENT_TYPE.LISTING_HIDDEN,
      });
      return persisted;
    });
    return staffView(this.dependencies, input.organizationId, saved);
  }
}

export class UnhideListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingId: ListingId;
    readonly version: number;
    readonly actorUserId: UserId;
  }): Promise<ListingResponse> {
    const { listings, unitOfWork, clock } = this.dependencies;
    const saved = await unitOfWork.run(async () => {
      const existing = await listings.findById(input.listingId);
      if (existing === undefined) throw listingNotFound();
      const next = existing.unhide(clock.now(), input.actorUserId);
      const persisted = await listings.save(next, input.version, input.actorUserId);
      await recordListingChange(this.dependencies, {
        action: AUDIT_ACTION.LISTING_REVEALED,
        before: existing,
        after: persisted,
        eventType: DIRECTORY_EVENT_TYPE.LISTING_UNHIDDEN,
      });
      return persisted;
    });
    return staffView(this.dependencies, input.organizationId, saved);
  }
}

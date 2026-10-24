import { AUDIT_ACTION } from "@banijjik/contracts";
import type {
  CustomerDataExportParticipant,
  CustomerErasureParticipant,
  DirectoryActivityExportSection,
  ListingExportSection,
} from "@banijjik/contracts/contact";
import { DIRECTORY_EVENT_TYPE, LISTING_VIEWER } from "@banijjik/contracts/directory";
import { asId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import type { DirectoryDependencies } from "./directory-dependencies.js";
import { recordListingChange } from "./listing-records.js";
import { toListingResponse } from "./listing-view.js";
import { asListingFieldRules } from "./ports/directory-context-ports.js";

export function buildDirectoryErasureParticipant(
  dependencies: DirectoryDependencies,
): CustomerErasureParticipant {
  return {
    async eraseForAccount(input) {
      const { listings, reports, blocks } = dependencies;
      const accountId = asId<CustomerAccountId>(input.customerAccountId);
      const existing = await listings.findActiveByOwner(accountId);
      if (existing !== undefined) {
        const archived = existing.archive(input.now);
        const persisted = await listings.save(archived, existing.version, null);
        await recordListingChange(dependencies, {
          action: AUDIT_ACTION.LISTING_ARCHIVED,
          before: existing,
          after: persisted,
          eventType: DIRECTORY_EVENT_TYPE.LISTING_ARCHIVED,
        });
      }
      await blocks.deleteByAccount(accountId);
      await reports.deleteOpenByReporter(accountId);
    },
  };
}

function buildListingExportParticipant(
  dependencies: DirectoryDependencies,
): CustomerDataExportParticipant {
  return {
    sectionKey: "LISTING",
    async exportForAccount(input): Promise<ListingExportSection> {
      const { listings, fields, settings } = dependencies;
      const accountId = asId<CustomerAccountId>(input.customerAccountId);
      const organizationId = asId<OrganizationId>(input.organizationId);
      const listing = await listings.findActiveByOwner(accountId);
      if (listing === undefined) {
        return { sectionKey: "LISTING", listing: null, truncated: false };
      }
      const [rawFields, photoPolicy] = await Promise.all([
        fields.forOrganization(organizationId),
        settings.photoPolicy(organizationId),
      ]);
      const response = toListingResponse({
        listing,
        fields: asListingFieldRules(rawFields),
        viewer: LISTING_VIEWER.OWNER,
        photoPolicy,
      });
      return {
        sectionKey: "LISTING",
        listing: response as unknown as Record<string, unknown>,
        truncated: false,
      };
    },
  };
}

function buildActivityExportParticipant(
  dependencies: DirectoryDependencies,
): CustomerDataExportParticipant {
  return {
    sectionKey: "DIRECTORY_ACTIVITY",
    async exportForAccount(input): Promise<DirectoryActivityExportSection> {
      const { blocks, reports, listings } = dependencies;
      const accountId = asId<CustomerAccountId>(input.customerAccountId);
      const fetchLimit = input.maxRows + 1;
      const [pagedBlocks, rawReports] = await Promise.all([
        blocks.listByAccount(accountId, { page: 1, limit: fetchLimit }),
        reports.listByReporter(accountId, fetchLimit),
      ]);
      const blocksTruncated = pagedBlocks.items.length > input.maxRows;
      const slicedBlocks = blocksTruncated
        ? pagedBlocks.items.slice(0, input.maxRows)
        : pagedBlocks.items;
      const reportsTruncated = rawReports.length > input.maxRows;
      const slicedReports = reportsTruncated ? rawReports.slice(0, input.maxRows) : rawReports;
      const listingIds = slicedBlocks.map((b) => b.listingId);
      const blockListings = await listings.findByIds(listingIds);
      const listingMap = new Map(blockListings.map((l) => [l.listingId, l.listingNumber]));
      return {
        sectionKey: "DIRECTORY_ACTIVITY",
        blocks: slicedBlocks.map((b) => ({
          listingBlockId: b.listingBlockId,
          listingId: b.listingId,
          listingNumber: listingMap.get(b.listingId) ?? "",
          createdAt: b.createdAt.toISOString(),
        })),
        blocksTruncated,
        reports: slicedReports.map((r) => ({
          listingReportId: r.listingReportId,
          listingId: r.listingId,
          reasonKey: r.reasonKey,
          note: r.note ?? null,
          status: r.status,
          outcome: r.outcome ?? null,
          createdAt: r.createdAt.toISOString(),
          resolvedAt: r.resolvedAt?.toISOString() ?? null,
        })),
        reportsTruncated,
        truncated: blocksTruncated || reportsTruncated,
      };
    },
  };
}

export function buildDirectoryExportParticipants(
  dependencies: DirectoryDependencies,
): readonly CustomerDataExportParticipant[] {
  return [
    buildListingExportParticipant(dependencies),
    buildActivityExportParticipant(dependencies),
  ];
}

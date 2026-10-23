import {
  asId,
  type CustomerAccountId,
  type ListingId,
  type ListingReportId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { ListingReport } from "../domain/listing-report.entity.js";
import type { ListingReportDocument } from "./listing-report.schema.js";

function withoutEmpty<Value>(value: Value | null | undefined): Value | undefined {
  if (value === null || value === undefined) return undefined;
  return value;
}

export function toListingReportDocument(report: ListingReport): ListingReportDocument {
  return {
    listingReportId: report.listingReportId,
    organizationId: report.organizationId,
    listingId: report.listingId,
    reporterCustomerAccountId: report.reporterCustomerAccountId,
    reasonKey: report.reasonKey,
    ...(report.note === undefined ? {} : { note: report.note }),
    status: report.status,
    ...(report.outcome === undefined ? {} : { outcome: report.outcome }),
    ...(report.resolvedByUserId === undefined ? {} : { resolvedByUserId: report.resolvedByUserId }),
    ...(report.resolvedAt === undefined ? {} : { resolvedAt: report.resolvedAt }),
    ...(report.resolutionNote === undefined ? {} : { resolutionNote: report.resolutionNote }),
    version: report.version,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    createdByUserId: report.createdByUserId,
    updatedByUserId: report.updatedByUserId,
  };
}

export function toListingReport(document: ListingReportDocument): ListingReport {
  const stored = stripMongoInternals(document);
  return ListingReport.restore({
    listingReportId: asId<ListingReportId>(stored.listingReportId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    listingId: asId<ListingId>(stored.listingId),
    reporterCustomerAccountId: asId<CustomerAccountId>(stored.reporterCustomerAccountId),
    reasonKey: stored.reasonKey,
    note: withoutEmpty(stored.note),
    status: stored.status,
    outcome: withoutEmpty(stored.outcome),
    resolvedByUserId:
      stored.resolvedByUserId === undefined || stored.resolvedByUserId === null
        ? undefined
        : asId<UserId>(stored.resolvedByUserId),
    resolvedAt: withoutEmpty(stored.resolvedAt),
    resolutionNote: withoutEmpty(stored.resolutionNote),
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: stored.createdByUserId === null ? null : asId<UserId>(stored.createdByUserId),
    updatedByUserId: stored.updatedByUserId === null ? null : asId<UserId>(stored.updatedByUserId),
  });
}

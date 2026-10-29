import {
  asId,
  type OrganizationId,
  type SiteDomainId,
  type SiteId,
  type UserId,
} from "@banijjik/ids";
import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { SiteDomainRepository } from "../application/ports/site-domain-ports.js";
import { SiteDomain } from "../domain/site-domain.entity.js";
import { SITE_DOMAIN_MODEL_NAME, type SiteDomainDocument } from "./site-domain.schema.js";

function domainModel(): Model<SiteDomainDocument> {
  return models({}).get<SiteDomainDocument>(SITE_DOMAIN_MODEL_NAME);
}

function toDomain(row: SiteDomainDocument): SiteDomain {
  return SiteDomain.rehydrate({
    siteDomainId: asId<SiteDomainId>(row.siteDomainId),
    organizationId: asId<OrganizationId>(row.organizationId),
    siteId: asId<SiteId>(row.siteId),
    hostname: row.hostname,
    status: row.status,
    providerHostnameId: row.providerHostnameId,
    operationGeneration: row.operationGeneration,
    nextAttemptAt: row.nextAttemptAt,
    lastVerifiedAt: row.lastVerifiedAt,
    ownershipRecords: row.ownershipRecords,
    certificateRecords: row.certificateRecords,
    safeDiagnosticKey: row.safeDiagnosticKey,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

function documentOf(domain: SiteDomain): SiteDomainDocument {
  return {
    siteDomainId: domain.siteDomainId,
    organizationId: domain.organizationId,
    siteId: domain.siteId,
    hostname: domain.hostname,
    status: domain.status,
    providerHostnameId: domain.providerHostnameId,
    operationGeneration: domain.operationGeneration,
    nextAttemptAt: domain.nextAttemptAt,
    lastVerifiedAt: domain.lastVerifiedAt,
    ownershipRecords: [...domain.ownershipRecords],
    certificateRecords: [...domain.certificateRecords],
    safeDiagnosticKey: domain.safeDiagnosticKey,
    version: domain.version,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    createdByUserId: domain.createdByUserId,
    updatedByUserId: domain.updatedByUserId,
  };
}

const LIST_SORT = { createdAt: -1, siteDomainId: 1 } as const;

export class MongoSiteDomainRepository implements SiteDomainRepository {
  async insert(domain: SiteDomain): Promise<"inserted" | "duplicate"> {
    try {
      await domainModel().create([documentOf(domain)], sessionOption(getActiveSession()));
      return "inserted";
    } catch (error) {
      if (isDuplicateKeyError(error)) return "duplicate";
      throw error;
    }
  }

  async findById(siteDomainId: SiteDomainId): Promise<SiteDomain | undefined> {
    const row = await domainModel()
      .findOne({ siteDomainId }, undefined, sessionOption(getActiveSession()))
      .lean<SiteDomainDocument>();
    return row === null ? undefined : toDomain(row);
  }

  async save(domain: SiteDomain, expectedVersion: number): Promise<void> {
    await updateVersioned<SiteDomainDocument>({
      model: domainModel(),
      filter: { siteDomainId: domain.siteDomainId },
      expectedVersion,
      update: {
        $set: {
          status: domain.status,
          providerHostnameId: domain.providerHostnameId,
          operationGeneration: domain.operationGeneration,
          nextAttemptAt: domain.nextAttemptAt,
          lastVerifiedAt: domain.lastVerifiedAt,
          ownershipRecords: [...domain.ownershipRecords],
          certificateRecords: [...domain.certificateRecords],
          safeDiagnosticKey: domain.safeDiagnosticKey,
          updatedAt: domain.updatedAt,
          updatedByUserId: domain.updatedByUserId,
        },
      },
    });
  }

  async listPage(input: {
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly items: readonly SiteDomain[]; readonly total: number }> {
    const model = domainModel();
    const [rows, total] = await Promise.all([
      model
        .find({})
        .sort(LIST_SORT)
        .skip((input.page - 1) * input.limit)
        .limit(input.limit)
        .lean<SiteDomainDocument[]>(),
      model.countDocuments({}),
    ]);
    return { items: rows.map(toDomain), total };
  }
}

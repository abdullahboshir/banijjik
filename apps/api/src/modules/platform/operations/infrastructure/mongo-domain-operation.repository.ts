import {
  asId,
  type DomainOperationId,
  type OrganizationId,
  type SiteDomainId,
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
import type { DomainOperationRepository } from "../application/domain-provider.js";
import { DomainOperation, type DomainOperationAction } from "../domain/domain-operation.entity.js";
import {
  DOMAIN_OPERATION_MODEL_NAME,
  type DomainOperationDocument,
} from "./domain-operation.schema.js";

function operationModel(): Model<DomainOperationDocument> {
  return models({}).get<DomainOperationDocument>(DOMAIN_OPERATION_MODEL_NAME);
}

function toDomain(row: DomainOperationDocument): DomainOperation {
  return DomainOperation.rehydrate({
    domainOperationId: asId<DomainOperationId>(row.domainOperationId),
    organizationId: asId<OrganizationId>(row.organizationId),
    siteDomainId: asId<SiteDomainId>(row.siteDomainId),
    generation: row.generation,
    action: row.action,
    providerHostnameId: row.providerHostnameId,
    state: row.state,
    nextAttemptAt: row.nextAttemptAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

function documentOf(operation: DomainOperation): DomainOperationDocument {
  return {
    domainOperationId: operation.domainOperationId,
    organizationId: operation.organizationId,
    siteDomainId: operation.siteDomainId,
    generation: operation.generation,
    action: operation.action,
    providerHostnameId: operation.providerHostnameId,
    state: operation.state,
    nextAttemptAt: operation.nextAttemptAt,
    version: operation.version,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
    createdByUserId: operation.createdByUserId,
    updatedByUserId: operation.updatedByUserId,
  };
}

export class MongoDomainOperationRepository implements DomainOperationRepository {
  async findByNaturalKey(input: {
    readonly siteDomainId: SiteDomainId;
    readonly generation: number;
    readonly action: DomainOperationAction;
  }): Promise<DomainOperation | undefined> {
    const row = await operationModel()
      .findOne(
        {
          siteDomainId: input.siteDomainId,
          generation: input.generation,
          action: input.action,
        },
        undefined,
        sessionOption(getActiveSession()),
      )
      .lean<DomainOperationDocument>();
    return row === null ? undefined : toDomain(row);
  }

  async insert(operation: DomainOperation): Promise<"inserted" | "duplicate"> {
    try {
      await operationModel().create([documentOf(operation)], sessionOption(getActiveSession()));
      return "inserted";
    } catch (error) {
      if (isDuplicateKeyError(error)) return "duplicate";
      throw error;
    }
  }

  async save(operation: DomainOperation, expectedVersion: number): Promise<void> {
    await updateVersioned<DomainOperationDocument>({
      model: operationModel(),
      filter: { domainOperationId: operation.domainOperationId },
      expectedVersion,
      update: {
        $set: {
          providerHostnameId: operation.providerHostnameId,
          state: operation.state,
          nextAttemptAt: operation.nextAttemptAt,
          updatedAt: operation.updatedAt,
          updatedByUserId: operation.updatedByUserId,
        },
      },
    });
  }
}

import { AUDIT_ACTION } from "@banijjik/contracts";
import {
  TAX_CLASS_STATUS,
  type TaxClassResponse,
  type TaxClassStatus,
} from "@banijjik/contracts/pricing";
import type { OrganizationId, TaxClassId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { MongoUnitOfWork } from "../../../../../kernel/db/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { TaxClass } from "../../domain/tax-class.entity.js";
import { recordNotFound, TaxClassKeyTakenError, taxClassKeyTaken } from "../../domain/errors.js";
import type { TaxClassRepository } from "../ports/pricing-repositories.js";
import { recordTaxClass, viewTaxClass } from "../pricing-views.js";

interface Actor {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

export interface PricingWriteDependencies {
  readonly taxClasses: TaxClassRepository;
  readonly unitOfWork: MongoUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export class CreateTaxClassUseCase {
  constructor(private readonly dependencies: PricingWriteDependencies) {}

  async execute(
    input: Actor & { taxClassKey: string; name: string; rateBasisPoints: number },
  ): Promise<TaxClassResponse> {
    const saved = await this.dependencies.unitOfWork.run(async () => {
      const taxClass = TaxClass.create({
        organizationId: input.organizationId,
        taxClassKey: input.taxClassKey,
        name: input.name,
        rateBasisPoints: input.rateBasisPoints,
        createdByUserId: input.actorUserId,
        now: this.dependencies.clock.now(),
      });
      try {
        await this.dependencies.taxClasses.insert(taxClass);
      } catch (error) {
        if (error instanceof TaxClassKeyTakenError) throw taxClassKeyTaken(error.taxClassKey);
        throw error;
      }
      await recordTaxClass(this.dependencies.audit, {
        action: AUDIT_ACTION.TAX_CLASS_CREATED,
        before: undefined,
        after: taxClass,
      });
      return taxClass;
    });
    return viewTaxClass(saved);
  }
}

export class UpdateTaxClassUseCase {
  constructor(private readonly dependencies: PricingWriteDependencies) {}

  async execute(
    input: Actor & {
      taxClassId: TaxClassId;
      version: number;
      name?: string;
      rateBasisPoints?: number;
    },
  ): Promise<TaxClassResponse> {
    const saved = await this.dependencies.unitOfWork.run(async () => {
      const existing = await this.dependencies.taxClasses.findById(input.taxClassId);
      if (existing === undefined) throw recordNotFound();
      const edited = existing.withChanges(
        {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.rateBasisPoints === undefined
            ? {}
            : { rateBasisPoints: input.rateBasisPoints }),
        },
        this.dependencies.clock.now(),
      );
      const updated = await this.dependencies.taxClasses.update(
        edited,
        input.version,
        input.actorUserId,
      );
      await recordTaxClass(this.dependencies.audit, {
        action: AUDIT_ACTION.TAX_CLASS_UPDATED,
        before: existing,
        after: updated,
      });
      return updated;
    });
    return viewTaxClass(saved);
  }
}

export class ArchiveTaxClassUseCase {
  constructor(private readonly dependencies: PricingWriteDependencies) {}

  async execute(
    input: Actor & { taxClassId: TaxClassId; version: number },
  ): Promise<TaxClassResponse> {
    const saved = await this.dependencies.unitOfWork.run(async () => {
      const existing = await this.dependencies.taxClasses.findById(input.taxClassId);
      if (existing === undefined) throw recordNotFound();
      const archived = existing.archive(this.dependencies.clock.now());
      const updated = await this.dependencies.taxClasses.update(
        archived,
        input.version,
        input.actorUserId,
      );
      await recordTaxClass(this.dependencies.audit, {
        action: AUDIT_ACTION.TAX_CLASS_ARCHIVED,
        before: existing,
        after: updated,
      });
      return updated;
    });
    return viewTaxClass(saved);
  }
}

export class ListTaxClassesUseCase {
  constructor(private readonly taxClasses: TaxClassRepository) {}

  async execute(input: {
    organizationId: OrganizationId;
    page: number;
    limit: number;
    status?: TaxClassStatus;
  }): Promise<{ items: TaxClassResponse[]; hasNext: boolean }> {
    const result = await this.taxClasses.list({
      page: input.page,
      limit: input.limit,
      status: input.status ?? TAX_CLASS_STATUS.ACTIVE,
    });
    return { items: result.items.map(viewTaxClass), hasNext: result.hasNext };
  }
}

export class GetTaxClassUseCase {
  constructor(private readonly taxClasses: TaxClassRepository) {}

  async execute(input: {
    organizationId: OrganizationId;
    taxClassId: TaxClassId;
  }): Promise<TaxClassResponse> {
    const taxClass = await this.taxClasses.findById(input.taxClassId);
    if (taxClass === undefined) throw recordNotFound();
    return viewTaxClass(taxClass);
  }
}

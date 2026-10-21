import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  type AuditAction,
  type CurrencyCode,
} from "@banijjik/contracts";
import type {
  CreditPack,
  CreditPackCreateRequest,
  CreditPackUpdateRequest,
} from "@banijjik/contracts/credit";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { CreditPackCurrencyMismatchError, CreditPackNotFoundError } from "../../domain/index.js";
import { CreditPackEntity } from "../../domain/credit-pack.entity.js";
import { getRequestContext } from "../../../../../kernel/context/index.js";

export interface CreditPackPage {
  readonly items: readonly CreditPack[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

function organizationIdOf(): OrganizationId {
  const { organizationId } = getRequestContext();
  if (!organizationId) throw new Error("Organization context required for a credit pack");
  return organizationId as OrganizationId;
}

/** Staff list, newest sort order first, archived packs included (they can be archived again). */
export class ListCreditPacksUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(options: { limit: number; offset: number; page: number }): Promise<CreditPackPage> {
    const page = await this.deps.packs.list(organizationIdOf(), {
      limit: options.limit,
      offset: options.offset,
    });
    return { items: page.items, total: page.total, page: options.page, limit: options.limit };
  }
}

/** The public list customers see when buying credits (M.5/M.6): ACTIVE packs only. */
export class ListActiveCreditPacksUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(): Promise<readonly CreditPack[]> {
    return this.deps.packs.listActive(organizationIdOf());
  }
}

export class CreateCreditPackUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(input: CreditPackCreateRequest, actorUserId: UserId | null): Promise<CreditPack> {
    const organizationId = organizationIdOf();
    await this.assertCurrency(organizationId, input.price.currency);
    const pack = CreditPackEntity.create(
      {
        creditPackId: newId(),
        organizationId,
        name: input.name,
        credits: input.credits,
        price: input.price,
        validityDays: input.validityDays,
        sortOrder: input.sortOrder,
      },
      this.deps.clock.now(),
    );
    const created = pack.toResponse();
    return this.deps.unitOfWork.run(async () => {
      await this.deps.packs.insert(created);
      await this.recordAudit(AUDIT_ACTION.CREDIT_PACK_CREATED, created, actorUserId);
      return created;
    });
  }

  private async assertCurrency(
    organizationId: OrganizationId,
    currency: CurrencyCode,
  ): Promise<void> {
    const expected = await this.deps.currency.read(organizationId);
    if (expected !== currency) throw new CreditPackCurrencyMismatchError();
  }

  private async recordAudit(
    action: AuditAction,
    pack: CreditPack,
    actorUserId: UserId | null,
  ): Promise<void> {
    await this.deps.audit.record({
      action,
      entityType: AUDIT_ENTITY_TYPE.creditPack,
      entityId: pack.creditPackId,
      changes: {
        credits: { to: pack.credits },
        sortOrder: { to: pack.sortOrder },
        createdByUserId: { to: actorUserId },
      },
    });
  }
}

export class UpdateCreditPackUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(
    creditPackId: string,
    input: CreditPackUpdateRequest,
    actorUserId: UserId | null,
  ): Promise<CreditPack> {
    const organizationId = organizationIdOf();
    const existing = await this.deps.packs.findById(organizationId, creditPackId);
    if (!existing) throw new CreditPackNotFoundError();
    const expected = await this.deps.currency.read(organizationId);
    if (expected !== input.price.currency) throw new CreditPackCurrencyMismatchError();

    const entity = new CreditPackEntity(
      existing.creditPackId,
      organizationId,
      existing.name,
      existing.credits,
      existing.price,
      existing.validityDays,
      existing.status,
      existing.sortOrder,
      existing.version,
      new Date(existing.createdAt),
      new Date(existing.updatedAt),
    );
    const updated = entity.update(input, this.deps.clock.now()).toResponse();
    return this.deps.unitOfWork.run(async () => {
      const saved = await this.deps.packs.save(updated, input.version, actorUserId);
      await this.deps.audit.record({
        action: AUDIT_ACTION.CREDIT_PACK_UPDATED,
        entityType: AUDIT_ENTITY_TYPE.creditPack,
        entityId: creditPackId,
        changes: {
          credits: { from: existing.credits, to: saved.credits },
          sortOrder: { from: existing.sortOrder, to: saved.sortOrder },
        },
      });
      return saved;
    });
  }
}

export class ArchiveCreditPackUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(
    creditPackId: string,
    version: number,
    actorUserId: UserId | null,
  ): Promise<CreditPack> {
    const organizationId = organizationIdOf();
    const existing = await this.deps.packs.findById(organizationId, creditPackId);
    if (!existing) throw new CreditPackNotFoundError();
    const entity = new CreditPackEntity(
      existing.creditPackId,
      organizationId,
      existing.name,
      existing.credits,
      existing.price,
      existing.validityDays,
      existing.status,
      existing.sortOrder,
      existing.version,
      new Date(existing.createdAt),
      new Date(existing.updatedAt),
    );
    const archived = entity.archive(this.deps.clock.now()).toResponse();
    return this.deps.unitOfWork.run(async () => {
      const saved = await this.deps.packs.save(archived, version, actorUserId);
      await this.deps.audit.record({
        action: AUDIT_ACTION.CREDIT_PACK_ARCHIVED,
        entityType: AUDIT_ENTITY_TYPE.creditPack,
        entityId: creditPackId,
        changes: { status: { from: existing.status, to: saved.status } },
      });
      return saved;
    });
  }
}

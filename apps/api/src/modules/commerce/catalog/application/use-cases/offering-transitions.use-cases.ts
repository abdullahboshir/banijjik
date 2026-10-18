import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { OfferingId, OrganizationId, UserId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type { Offering } from "../../domain/offering.entity.js";
import type { CatalogDependencies } from "../catalog-dependencies.js";
import { assertReferencesUsable } from "../catalog-references.js";
import { recordOfferingTransition } from "../offering-records.js";
import { viewOffering } from "../offering-view.js";

export interface OfferingTransitionInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly offeringId: OfferingId;
  readonly version: number;
}

async function load(dependencies: CatalogDependencies, offeringId: OfferingId): Promise<Offering> {
  const offering = await dependencies.offerings.findById(offeringId);
  if (offering === undefined) throw recordNotFound();
  return offering;
}

/**
 * DRAFT becomes ACTIVE. Publishing an ACTIVE offering again is a 200 with nothing written. What the
 * offering names (categories, add-ons, images) must still be usable, because it is about to reach
 * the storefront and the bot (ADR-026).
 */
export class PublishOfferingUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: OfferingTransitionInput): Promise<OfferingResponse> {
    const { unitOfWork, customFields, categories, modifierGroups, images } = this.dependencies;
    const saved = await unitOfWork.run(async () => {
      const existing = await load(this.dependencies, input.offeringId);
      const published = existing.publish();
      if (published === existing) return existing;
      await assertReferencesUsable({ categories, modifierGroups, images }, existing);
      return this.save(input, existing, published);
    });
    const fields = await customFields.forOffering(input.organizationId, saved.kind);
    return viewOffering(this.dependencies, saved, fields);
  }

  private async save(
    input: OfferingTransitionInput,
    before: Offering,
    published: Offering,
  ): Promise<Offering> {
    const updated = await this.dependencies.offerings.update(
      published,
      input.version,
      input.actorUserId,
    );
    await recordOfferingTransition(this.dependencies, {
      before,
      after: updated,
      isArchive: false,
    });
    return updated;
  }
}

/** An archived offering is read-only and frees nothing; it no longer counts against the package limit. */
export class ArchiveOfferingUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: OfferingTransitionInput): Promise<OfferingResponse> {
    const { unitOfWork, customFields, offerings, counter } = this.dependencies;
    const saved = await unitOfWork.run(async () => {
      const existing = await load(this.dependencies, input.offeringId);
      const archived = existing.archive();
      const updated = await offerings.update(archived, input.version, input.actorUserId);
      await counter.decrement();
      await recordOfferingTransition(this.dependencies, {
        before: existing,
        after: updated,
        isArchive: true,
      });
      return updated;
    });
    const fields = await customFields.forOffering(input.organizationId, saved.kind);
    return viewOffering(this.dependencies, saved, fields);
  }
}

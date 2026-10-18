import type { EffectiveCustomField } from "@banijjik/contracts";
import type { KindDetails, OfferingResponse } from "@banijjik/contracts/catalog";
import type { OfferingId, OrganizationId, UserId } from "@banijjik/ids";
import type { VariantInput } from "@banijjik/validation";
import { recordNotFound } from "../../domain/errors.js";
import type { Offering, OfferingChanges } from "../../domain/offering.entity.js";
import type { Variant } from "../../domain/variant.js";
import { assertKindDetailsCurrency, mergeVariants } from "../../domain/variant-merge.js";
import type { CatalogDependencies } from "../catalog-dependencies.js";
import { assertReferencesUsable } from "../catalog-references.js";
import { mergeCustomFieldValues, type MergedCustomFields } from "../custom-field-values.js";
import { resolveKindDetails, resolveVariantDrafts } from "../kind-parts.js";
import { recordOfferingUpdated } from "../offering-records.js";
import { assertSkusFree, chooseSlug, explainIndexRefusal, skusOf } from "../offering-uniqueness.js";
import { viewOffering } from "../offering-view.js";

export interface UpdateOfferingInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly offeringId: OfferingId;
  readonly version: number;
  readonly name?: string | undefined;
  readonly slug?: string | undefined;
  readonly description?: string | null | undefined;
  readonly categoryIds?: readonly string[] | undefined;
  readonly modifierGroupIds?: readonly string[] | undefined;
  readonly imageFileIds?: readonly string[] | undefined;
  /** Replaces the stored details; checked against the stored kind here. */
  readonly kindDetails?: Readonly<Record<string, unknown>> | undefined;
  readonly taxClassKey?: string | null | undefined;
  readonly synonyms?: readonly string[] | undefined;
  /** The full variant list: kept ids stay, no id is new, a missing one is archived. */
  readonly variants?: readonly VariantInput[] | undefined;
  /** Per key: a value sets it, `null` clears it, an absent key leaves it. */
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Edits an offering. The kind is fixed; `kindDetails` and `variants` are checked against it. The
 * variant list is the subtle part (ADR-116): ids are kept, a variant left out is archived and never
 * deleted, so orders and bookings that name `(offeringId, variantId)` stay valid. Everything that
 * can be refused is refused before the write; the version check, audit entry and events share one
 * transaction.
 */
export class UpdateOfferingUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: UpdateOfferingInput): Promise<OfferingResponse> {
    const { offerings, customFields } = this.dependencies;
    const current = await offerings.findById(input.offeringId);
    if (current === undefined) throw recordNotFound();
    const fields = await customFields.forOffering(input.organizationId, current.kind);
    const saved = await this.updateExplained(input, current, fields);
    return viewOffering(this.dependencies, saved, fields);
  }

  /** A unique-index refusal (a concurrent write took the SKU or slug) is explained once the transaction has ended. */
  private async updateExplained(
    input: UpdateOfferingInput,
    current: Offering,
    fields: readonly EffectiveCustomField[],
  ): Promise<Offering> {
    try {
      return await this.updateOnce(input, current, fields);
    } catch (error) {
      throw await explainIndexRefusal(this.dependencies.offerings, error);
    }
  }

  private async updateOnce(
    input: UpdateOfferingInput,
    current: Offering,
    fields: readonly EffectiveCustomField[],
  ): Promise<Offering> {
    const { organization, unitOfWork, categories, modifierGroups, images } = this.dependencies;
    const { currency } = await organization.read(input.organizationId);
    await assertReferencesUsable({ categories, modifierGroups, images }, input);
    const changes = await this.checkedChanges(input, current, currency);
    return unitOfWork.run(() => this.updateInside(input, fields, changes));
  }

  /** Everything that can be refused without writing: kind details, variants, the slug. */
  private async checkedChanges(
    input: UpdateOfferingInput,
    current: Offering,
    currency: string,
  ): Promise<OfferingChanges> {
    const kindDetails =
      input.kindDetails === undefined
        ? undefined
        : resolveKindDetails(current.kind, input.kindDetails);
    if (kindDetails !== undefined) assertKindDetailsCurrency(kindDetails, currency);
    const variants =
      input.variants === undefined
        ? undefined
        : mergeVariants({
            existing: current.variants,
            drafts: resolveVariantDrafts(current.kind, input.variants),
            currency,
          });
    const slug = await this.slugFor(input, current);
    return changesOf(input, { slug, kindDetails, variants });
  }

  /** A rename keeps the slug (links stay valid) unless the request names one. */
  private async slugFor(
    input: UpdateOfferingInput,
    current: Offering,
  ): Promise<string | undefined> {
    if (input.slug === undefined) return undefined;
    return chooseSlug(this.dependencies.offerings, {
      name: input.name ?? current.name,
      explicitSlug: input.slug,
      offeringId: current.offeringId,
      currentSlug: current.slug,
    });
  }

  private async updateInside(
    input: UpdateOfferingInput,
    fields: readonly EffectiveCustomField[],
    changes: OfferingChanges,
  ): Promise<Offering> {
    const { offerings } = this.dependencies;
    const existing = await offerings.findById(input.offeringId);
    if (existing === undefined) throw recordNotFound();
    const merged = await this.mergedCustomFields(input, existing, fields);
    const edited = existing.withChanges({
      ...changes,
      ...(merged === undefined ? {} : { customFields: merged }),
    });
    await assertSkusFree(offerings, {
      offeringId: existing.offeringId,
      variants: edited.variants,
      alreadyHeld: skusOf(existing.variants),
    });
    const updated = await offerings.update(edited, input.version, input.actorUserId);
    await recordOfferingUpdated(this.dependencies, {
      before: existing,
      after: updated,
      ...(merged === undefined ? {} : { customFieldChanges: merged.auditChanges }),
    });
    return updated;
  }

  private async mergedCustomFields(
    input: UpdateOfferingInput,
    existing: Offering,
    fields: readonly EffectiveCustomField[],
  ): Promise<MergedCustomFields | undefined> {
    if (input.customFields === undefined) return undefined;
    return mergeCustomFieldValues({
      stored: existing.customFields.values,
      requested: input.customFields,
      fields,
      mode: "UPDATE",
      canWriteSensitive: await this.dependencies.sensitiveAccess.maySeeSensitive(),
    });
  }
}

/** The request's fields as entity changes: only the ones that were sent. */
function changesOf(
  input: UpdateOfferingInput,
  checked: {
    readonly slug: string | undefined;
    readonly kindDetails: KindDetails | undefined;
    readonly variants: Variant[] | undefined;
  },
): OfferingChanges {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(checked.slug === undefined ? {} : { slug: checked.slug }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...listChangesOf(input),
    ...(checked.kindDetails === undefined ? {} : { kindDetails: checked.kindDetails }),
    ...(input.taxClassKey === undefined ? {} : { taxClassKey: input.taxClassKey }),
    ...(input.synonyms === undefined ? {} : { synonyms: input.synonyms }),
    ...(checked.variants === undefined ? {} : { variants: checked.variants }),
  };
}

function listChangesOf(input: UpdateOfferingInput): OfferingChanges {
  return {
    ...(input.categoryIds === undefined ? {} : { categoryIds: input.categoryIds }),
    ...(input.modifierGroupIds === undefined ? {} : { modifierGroupIds: input.modifierGroupIds }),
    ...(input.imageFileIds === undefined ? {} : { imageFileIds: input.imageFileIds }),
  };
}

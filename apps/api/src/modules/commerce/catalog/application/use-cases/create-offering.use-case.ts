import type { EffectiveCustomField, OfferingKind } from "@banijjik/contracts";
import { LIMIT_KEY } from "@banijjik/contracts";
import type { KindDetails, Money, OfferingResponse, UnitKey } from "@banijjik/contracts/catalog";
import type { OfferingId, OrganizationId, UserId } from "@banijjik/ids";
import type { VariantInput } from "@banijjik/validation";
import { kindNotAllowed, SlugTakenError } from "../../domain/errors.js";
import { Offering } from "../../domain/offering.entity.js";
import { assertKindDetailsCurrency, mergeVariants } from "../../domain/variant-merge.js";
import type { CatalogDependencies } from "../catalog-dependencies.js";
import { assertReferencesUsable } from "../catalog-references.js";
import { mergeCustomFieldValues } from "../custom-field-values.js";
import { resolveVariantDrafts } from "../kind-parts.js";
import { recordOfferingCreated } from "../offering-records.js";
import { assertSkusFree, chooseSlug, explainIndexRefusal, skusOf } from "../offering-uniqueness.js";
import { viewOffering } from "../offering-view.js";

export interface CreateOfferingInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly kind: OfferingKind;
  readonly name: string;
  readonly slug?: string | undefined;
  readonly description?: string | undefined;
  readonly categoryIds?: readonly string[] | undefined;
  readonly modifierGroupIds?: readonly string[] | undefined;
  readonly imageFileIds?: readonly string[] | undefined;
  /** Already checked against the kind by the request schema, defaults applied. */
  readonly kindDetails: KindDetails;
  readonly taxClassKey?: string | undefined;
  readonly synonyms?: readonly string[] | undefined;
  readonly variants?: readonly VariantInput[] | undefined;
  /** With no `variants`: the price and unit of the one "Default" variant. */
  readonly price?: Money | undefined;
  readonly unitKey?: UnitKey | undefined;
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
}

/** What is read and decided before the transaction. */
interface PreparedCreate {
  readonly offeringId: OfferingId;
  readonly fields: readonly EffectiveCustomField[];
  readonly currency: string;
}

/**
 * Adds an offering as a DRAFT with at least one variant (09 section 5.3). The kind must be one the
 * organization's template allows. Everything that can be refused is refused before anything is
 * written; the limit counter, the SKU check, the insert, the audit entry and the event then share
 * one transaction. A taken slug made from the name is retried once with the next free one.
 */
export class CreateOfferingUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: CreateOfferingInput): Promise<OfferingResponse> {
    const prepared = await this.prepare(input);
    const saved = await this.createWithSlugRetry(input, prepared);
    return viewOffering(this.dependencies, saved, prepared.fields);
  }

  private async prepare(input: CreateOfferingInput): Promise<PreparedCreate> {
    const { organization, customFields, images, categories, modifierGroups } = this.dependencies;
    const context = await organization.read(input.organizationId);
    if (!context.kinds.includes(input.kind)) throw kindNotAllowed();
    assertKindDetailsCurrency(input.kindDetails, context.currency);
    await assertReferencesUsable({ categories, modifierGroups, images }, input);
    const fields = await customFields.forOffering(input.organizationId, input.kind);
    return { offeringId: Offering.newId(), fields, currency: context.currency };
  }

  private async createWithSlugRetry(
    input: CreateOfferingInput,
    prepared: PreparedCreate,
  ): Promise<Offering> {
    try {
      return await this.createOnce(input, prepared);
    } catch (error) {
      const canRetry = error instanceof SlugTakenError && input.slug === undefined;
      if (!canRetry) throw await explainIndexRefusal(this.dependencies.offerings, error);
      return this.createOnce(input, prepared);
    }
  }

  private async createOnce(
    input: CreateOfferingInput,
    prepared: PreparedCreate,
  ): Promise<Offering> {
    const { offerings, unitOfWork } = this.dependencies;
    const slug = await chooseSlug(offerings, {
      name: input.name,
      explicitSlug: input.slug,
      offeringId: prepared.offeringId,
    });
    const variants = await this.variantsOf(input, prepared.currency);
    return unitOfWork.run(() => this.createInside(input, prepared, { slug, variants }));
  }

  private async variantsOf(input: CreateOfferingInput, currency: string) {
    const inputs: readonly VariantInput[] = input.variants ?? [await this.defaultVariant(input)];
    const drafts = resolveVariantDrafts(input.kind, inputs);
    return mergeVariants({ existing: [], drafts, currency });
  }

  private async defaultVariant(input: CreateOfferingInput): Promise<VariantInput> {
    const unitKey =
      input.unitKey ?? (await this.dependencies.defaultUnits.read(input.organizationId));
    // Safe: the request schema requires a price when there are no variants.
    return { price: input.price as Money, unitKey };
  }

  private async createInside(
    input: CreateOfferingInput,
    prepared: PreparedCreate,
    chosen: { readonly slug: string; readonly variants: Offering["variants"] },
  ): Promise<Offering> {
    const { offerings, counter, limits, clock, sensitiveAccess } = this.dependencies;
    const existingCount = (await counter.increment()) - 1;
    await limits.assertBelow(LIMIT_KEY.OFFERINGS, existingCount);
    await assertSkusFree(offerings, {
      offeringId: prepared.offeringId,
      variants: chosen.variants,
      alreadyHeld: skusOf([]),
    });
    const merged = mergeCustomFieldValues({
      stored: {},
      requested: input.customFields ?? {},
      fields: prepared.fields,
      mode: "CREATE",
      canWriteSensitive: await sensitiveAccess.maySeeSensitive(),
    });
    const offering = Offering.create({
      offeringId: prepared.offeringId,
      organizationId: input.organizationId,
      kind: input.kind,
      name: input.name,
      slug: chosen.slug,
      description: input.description,
      categoryIds: input.categoryIds,
      modifierGroupIds: input.modifierGroupIds,
      imageFileIds: input.imageFileIds,
      variants: chosen.variants,
      kindDetails: input.kindDetails,
      taxClassKey: input.taxClassKey,
      synonyms: input.synonyms,
      customFields: merged,
      createdByUserId: input.actorUserId,
      now: clock.now(),
    });
    await offerings.insert(offering);
    await recordOfferingCreated(this.dependencies, offering, merged.auditChanges);
    return offering;
  }
}

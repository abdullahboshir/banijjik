import {
  CUSTOM_FIELD_ENTITY_TYPE,
  type CurrencyCode,
  type OfferingKind,
} from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import {
  OFFERING_STATUS,
  VARIANT_STATUS,
  type PublicCategoriesResponse,
  type PublicModifierGroupResponse,
  type PublicOfferingDetailResponse,
  type PublicOfferingListResponse,
  type PublicOfferingsQuery,
  type PublicVariantResponse,
  toLocalizedText,
} from "@banijjik/contracts/catalog";
import { publicFilePath } from "@banijjik/contracts/file";
import { escapeRegExp } from "@banijjik/validation";
import { models } from "../../../../kernel/db/index.js";
import { buildEffectiveCustomFieldReader } from "../../../core/custom-field/index.js";
import type { PublicCatalogReader } from "../application/ports/public-catalog-reader.port.js";
import { foldText } from "../domain/name-search.js";
import { OFFERING_MODEL_NAME, type OfferingDocument } from "./offering.schema.js";
import {
  CATEGORY_MODEL_NAME,
  MODIFIER_GROUP_MODEL_NAME,
  OFFERING_LOCATION_MODEL_NAME,
  type CategoryDocument,
  type ModifierGroupDocument,
  type OfferingLocationDocument,
} from "./record.schemas.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function buildOfferingFilter(
  allowedKinds: readonly OfferingKind[],
  query: PublicOfferingsQuery,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    status: OFFERING_STATUS.ACTIVE,
    kind: query.kind !== undefined ? query.kind : { $in: allowedKinds },
  };
  if (query.categoryId !== undefined) filter["categoryIds"] = query.categoryId;
  if (query.q && query.q.trim().length > 0) {
    const raw = query.q.trim();
    const prefix = new RegExp(`^${escapeRegExp(foldText(query.q))}`, "i");
    const contains = new RegExp(escapeRegExp(raw), "i");
    filter["$or"] = [
      { nameSearch: prefix },
      { searchTerms: prefix },
      { name: contains },
      { synonyms: contains },
    ];
  }
  return filter;
}

function effectiveVariantPrice(
  offeringId: string,
  variant: OfferingDocument["variants"][number],
  locationRows: readonly OfferingLocationDocument[],
): { amount: number; currency: CurrencyCode } {
  const locRow = locationRows.find(
    (r) => (offeringId === "" || r.offeringId === offeringId) && r.variantId === variant.variantId,
  );
  const p = locRow?.priceOverride ?? variant.price;
  return { amount: p.amount, currency: p.currency as CurrencyCode };
}

function computeStartingPrice(
  offeringId: string,
  variants: OfferingDocument["variants"],
  locationRows: readonly OfferingLocationDocument[],
): { amount: number; currency: CurrencyCode } {
  if (variants.length === 0) return { amount: 0, currency: "BDT" as CurrencyCode };
  let minAmount = Number.POSITIVE_INFINITY;
  let currency = "BDT" as CurrencyCode;

  for (const variant of variants) {
    const price = effectiveVariantPrice(offeringId, variant, locationRows);
    if (price.amount < minAmount) {
      minAmount = price.amount;
      currency = price.currency;
    }
  }
  return { amount: Number.isFinite(minAmount) ? minAmount : 0, currency };
}

function mapPublicVariants(
  variants: OfferingDocument["variants"],
  locationRows: readonly OfferingLocationDocument[],
): PublicVariantResponse[] {
  return variants.map((variant) => {
    const price = effectiveVariantPrice("", variant, locationRows);
    const locRow = locationRows.find((r) => r.variantId === variant.variantId);
    return {
      variantId: variant.variantId,
      name: toLocalizedText(variant.name),
      sku: variant.sku ?? null,
      price,
      isAvailable: locRow?.isAvailable !== false,
      attributes: variant.optionValues ?? {},
    };
  });
}

async function loadPublicCustomFields(
  organizationId: string,
  kind: OfferingKind,
  rawCustomFields: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  if (!rawCustomFields || typeof rawCustomFields !== "object") return {};
  const reader = buildEffectiveCustomFieldReader();
  const effectiveFields = await reader.forEntity(
    organizationId as OrganizationId,
    CUSTOM_FIELD_ENTITY_TYPE.offering,
    kind,
  );
  const storefrontKeys = new Set(
    effectiveFields.filter((f) => f.visibility.storefront && !f.isSensitive).map((f) => f.fieldKey),
  );
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(rawCustomFields)) {
    if (storefrontKeys.has(key)) result[key] = val;
  }
  return result;
}

export class MongoPublicCatalogReader implements PublicCatalogReader {
  async findPublicOfferings(input: {
    readonly organizationId: string;
    readonly allowedKinds: readonly OfferingKind[];
    readonly query: PublicOfferingsQuery;
  }): Promise<PublicOfferingListResponse> {
    const { allowedKinds, query } = input;
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const limit = Math.min(100, Math.max(1, query.limit ?? DEFAULT_LIMIT));
    if (allowedKinds.length === 0 || (query.kind && !allowedKinds.includes(query.kind))) {
      return { items: [], total: 0, page, limit };
    }
    const filter = buildOfferingFilter(allowedKinds, query);
    if (query.locationId !== undefined) {
      const unavailable = await this.loadUnavailableOfferingIds(query.locationId);
      if (unavailable.length > 0) filter["offeringId"] = { $nin: unavailable };
    }

    const offeringModel = this.offeringModel();
    const [total, documents] = await Promise.all([
      offeringModel.countDocuments(filter),
      offeringModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("offeringId slug name kind categoryIds variants imageFileIds")
        .lean<OfferingDocument[]>(),
    ]);

    const locationRows = await this.loadLocationRows(
      documents.map((d) => d.offeringId),
      query.locationId,
    );
    const items = documents.map((doc) => {
      const activeVariants = doc.variants.filter((v) => v.status === VARIANT_STATUS.ACTIVE);
      const startingPrice = computeStartingPrice(doc.offeringId, activeVariants, locationRows);
      const firstImage = doc.imageFileIds[0];
      return {
        offeringId: doc.offeringId,
        slug: doc.slug,
        name: toLocalizedText(doc.name),
        kind: doc.kind,
        categoryId: doc.categoryIds[0] ?? null,
        startingPrice,
        mediaUrl: firstImage !== undefined ? publicFilePath(firstImage, "medium") : null,
        activeLocationIds: query.locationId !== undefined ? [query.locationId] : [],
      };
    });
    return { items, total, page, limit };
  }

  async findPublicOfferingBySlug(input: {
    readonly organizationId: string;
    readonly slug: string;
    readonly allowedKinds: readonly OfferingKind[];
    readonly locationId?: string | undefined;
  }): Promise<PublicOfferingDetailResponse | null> {
    const { slug, allowedKinds, locationId } = input;
    const doc = await this.offeringModel()
      .findOne({ slug, status: OFFERING_STATUS.ACTIVE })
      .lean<OfferingDocument>();
    if (!doc || !allowedKinds.includes(doc.kind)) return null;

    const locationRows = locationId
      ? await this.locationModel()
          .find({ offeringId: doc.offeringId, locationId })
          .lean<OfferingLocationDocument[]>()
      : [];
    if (locationRows.some((row) => row.variantId === null && !row.isAvailable)) return null;

    const activeVariants = doc.variants.filter((v) => v.status === VARIANT_STATUS.ACTIVE);
    const publicVariants = mapPublicVariants(activeVariants, locationRows);
    const modifierGroups = await this.loadPublicModifierGroups(doc.modifierGroupIds);
    const publishedLocationIds = await this.loadPublishedLocationIds(doc.offeringId);
    const startingPrice = computeStartingPrice(doc.offeringId, activeVariants, locationRows);
    const publicCustomFields = await loadPublicCustomFields(
      input.organizationId,
      doc.kind,
      doc.customFields,
    );
    const firstImage = doc.imageFileIds[0];

    return {
      offeringId: doc.offeringId,
      slug: doc.slug,
      name: toLocalizedText(doc.name),
      kind: doc.kind,
      categoryId: doc.categoryIds[0] ?? null,
      startingPrice,
      mediaUrl: firstImage !== undefined ? publicFilePath(firstImage, "medium") : null,
      activeLocationIds: locationId !== undefined ? [locationId] : publishedLocationIds,
      description: doc.description ? toLocalizedText(doc.description) : null,
      variants: publicVariants,
      modifierGroups,
      publicCustomFields,
      publishedLocationIds,
    };
  }

  async findPublicCategories(input: {
    readonly organizationId: string;
    readonly allowedKinds: readonly OfferingKind[];
    readonly locationId?: string | undefined;
  }): Promise<PublicCategoriesResponse> {
    const categories = await this.categoryModel()
      .find({ status: "ACTIVE" })
      .sort({ sortOrder: 1, name: 1 })
      .lean<CategoryDocument[]>();
    const countFor = async (catId: string) =>
      input.allowedKinds.length === 0
        ? 0
        : this.offeringModel().countDocuments({
            status: OFFERING_STATUS.ACTIVE,
            kind: { $in: input.allowedKinds },
            categoryIds: catId,
          });
    const items = await Promise.all(
      categories.map(async (cat) => ({
        categoryId: cat.categoryId,
        slug: cat.slug,
        name: toLocalizedText(cat.name),
        parentCategoryId: cat.parentCategoryId ?? null,
        offeringCount: await countFor(cat.categoryId),
      })),
    );
    return { items };
  }

  private async loadUnavailableOfferingIds(locationId: string): Promise<string[]> {
    const rows = await this.locationModel()
      .find({ locationId, variantId: null, isAvailable: false })
      .select({ offeringId: 1 })
      .lean<OfferingLocationDocument[]>();
    return rows.map((row) => row.offeringId);
  }

  private async loadLocationRows(offeringIds: readonly string[], locationId?: string) {
    if (!locationId || offeringIds.length === 0) return [];
    return this.locationModel()
      .find({ offeringId: { $in: [...offeringIds] }, locationId })
      .lean<OfferingLocationDocument[]>();
  }

  private async loadPublishedLocationIds(offeringId: string) {
    const rows = await this.locationModel()
      .find({ offeringId, variantId: null, isAvailable: true })
      .select({ locationId: 1 })
      .lean<OfferingLocationDocument[]>();
    return rows.map((r) => r.locationId);
  }

  private async loadPublicModifierGroups(
    modifierGroupIds: readonly string[],
  ): Promise<PublicModifierGroupResponse[]> {
    if (modifierGroupIds.length === 0) return [];
    const groups = await this.modifierGroupModel()
      .find({ modifierGroupId: { $in: [...modifierGroupIds] }, status: "ACTIVE" })
      .lean<ModifierGroupDocument[]>();
    return groups.map((g) => ({
      modifierGroupId: g.modifierGroupId,
      name: toLocalizedText(g.name),
      isRequired: g.isRequired,
      minSelections: g.minSelect,
      maxSelections: g.maxSelect,
      options: g.options
        .filter((opt) => opt.status === "ACTIVE")
        .map((opt) => ({
          modifierOptionId: opt.modifierOptionId,
          name: toLocalizedText(opt.name),
          priceDelta: {
            amount: opt.priceDelta.amount,
            currency: opt.priceDelta.currency as CurrencyCode,
          },
        })),
    }));
  }

  private offeringModel = () => models({}).get<OfferingDocument>(OFFERING_MODEL_NAME);
  private categoryModel = () => models({}).get<CategoryDocument>(CATEGORY_MODEL_NAME);
  private modifierGroupModel = () =>
    models({}).get<ModifierGroupDocument>(MODIFIER_GROUP_MODEL_NAME);
  private locationModel = () =>
    models({}).get<OfferingLocationDocument>(OFFERING_LOCATION_MODEL_NAME);
}

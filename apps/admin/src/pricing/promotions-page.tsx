import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { CategoryResponse, OfferingListItem } from "@banijjik/contracts/catalog";
import type { PromotionResponse } from "@banijjik/contracts/pricing";
import { buttonVariants, EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { promotionLabelsOf } from "./pricing-labels";
import { PromotionsManager, type PreviewOfferingChoice } from "./promotions-manager";

const PAGE_LIMIT = 100;

async function loadPreviewOfferings(organizationId: string): Promise<PreviewOfferingChoice[]> {
  const rows = await fetchBusinessResourceIfAllowed<OfferingListItem[]>(
    `/orgs/${organizationId}/offerings?status=ACTIVE&limit=${PAGE_LIMIT}`,
  );
  if (!rows) return [];
  // List rows omit variants; load a few details for the preview picker.
  const choices: PreviewOfferingChoice[] = [];
  for (const row of rows.slice(0, 20)) {
    const detail = await fetchBusinessResourceIfAllowed<{
      offeringId: string;
      name: string;
      variants: { variantId: string }[];
    }>(`/orgs/${organizationId}/offerings/${row.offeringId}`);
    const variantId = detail?.variants[0]?.variantId;
    if (variantId) {
      choices.push({ offeringId: row.offeringId, name: row.name, variantId });
    }
  }
  return choices;
}

/** `/{orgSlug}/catalog/promotions`: discount rules and a quote preview. */
export async function PromotionsPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.PRICING_PROMOTION_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const [promotions, categories, locations, offerings] = await Promise.all([
    fetchBusinessResource<PromotionResponse[]>(
      `/orgs/${organizationId}/promotions?limit=${PAGE_LIMIT}`,
    ),
    fetchBusinessResourceIfAllowed<CategoryResponse[]>(
      `/orgs/${organizationId}/categories?limit=${PAGE_LIMIT}`,
    ),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=${PAGE_LIMIT}`,
    ),
    loadPreviewOfferings(organizationId),
  ]);
  const can = (key: Parameters<typeof holdsPermission>[1]): boolean =>
    access.canWrite && holdsPermission(permissions, key);
  const labels = promotionLabelsOf(t);
  return (
    <PageLayout
      title={labels["promotions.title"]}
      subtitle={access.canWrite ? labels["promotions.subtitle"] : labels["promotions.readOnly"]}
      actions={
        <Link href={`/${orgSlug}/catalog`} className={buttonVariants({ variant: "secondary" })}>
          {t("catalog.editor.back")}
        </Link>
      }
    >
      <PromotionsManager
        organizationId={organizationId}
        promotions={[...promotions.data]}
        categories={categories ?? []}
        locations={(locations ?? []).map(({ locationId, name }) => ({ locationId, name }))}
        offerings={offerings}
        labels={labels}
        canCreate={can(PERMISSION_KEY.PRICING_PROMOTION_CREATE)}
        canUpdate={can(PERMISSION_KEY.PRICING_PROMOTION_UPDATE)}
        canArchive={can(PERMISSION_KEY.PRICING_PROMOTION_ARCHIVE)}
      />
    </PageLayout>
  );
}

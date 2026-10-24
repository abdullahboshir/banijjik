import { MODULE_KEY, PERMISSION_KEY } from "@banijjik/contracts";
import type {
  CommissionMemberSummaryResponse,
  CommissionPayoutResponse,
} from "@banijjik/contracts/commission";
import type { Translator } from "@banijjik/i18n";
import { DetailHeader, EmptyState, PageSection, formatMoney } from "@banijjik/ui";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { payoutMethodLabelOf } from "./commission-labels";
import { loadCommissionLocations } from "./commission-lookups";
import { commissionSummaryApiPath } from "./commission-query";

const DASH = "—";

interface PayoutDetailData {
  payout: CommissionPayoutResponse;
  memberName: string | undefined;
  locationName: string | undefined;
}

function Fact(props: { label: string; children: string }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-small text-secondary">{props.label}</dt>
      <dd className="break-words text-body text-primary">{props.children}</dd>
    </div>
  );
}

async function loadCommissionPayoutDetailData(
  access: OrgAccess,
  commissionPayoutId: string,
): Promise<PayoutDetailData> {
  const { organizationId } = access.organization;
  const [{ data: payout }, summary, locations] = await Promise.all([
    fetchBusinessResource<CommissionPayoutResponse>(
      `/orgs/${organizationId}/commission/payouts/${commissionPayoutId}`,
    ),
    fetchBusinessResourceIfAllowed<CommissionMemberSummaryResponse[]>(
      commissionSummaryApiPath(organizationId, {
        memberId: undefined,
        locationId: undefined,
        from: undefined,
        to: undefined,
        page: 1,
      }),
    ),
    loadCommissionLocations(access),
  ]);
  return {
    payout,
    memberName: summary?.find((row) => row.memberId === payout.memberId)?.memberName,
    locationName: locations.find((row) => row.locationId === payout.locationId)?.name,
  };
}

function PayoutFacts(props: {
  data: PayoutDetailData;
  createdAt: string;
  translator: Translator;
}): ReactElement {
  const { payout, memberName, locationName } = props.data;
  const { t, locale } = props.translator;
  return (
    <PageSection title={t("commission.payout.title")}>
      <dl className="grid gap-4 md:grid-cols-2">
        <Fact label={t("commission.payout.member")}>
          {memberName ?? t("commission.rule.unknown")}
        </Fact>
        <Fact label={t("commission.payout.location")}>
          {locationName ?? t("commission.rule.unknown")}
        </Fact>
        <Fact label={t("commission.payout.upTo")}>{payout.upToBusinessDate}</Fact>
        <Fact label={t("commission.payout.total")}>{formatMoney(payout.total, { locale })}</Fact>
        <Fact label={t("commission.payout.method")}>{payoutMethodLabelOf(payout.method, t)}</Fact>
        <Fact label={t("commission.payout.reference")}>{payout.externalReference ?? DASH}</Fact>
        <Fact label={t("commission.payout.businessDate")}>{payout.businessDate}</Fact>
        <Fact label={t("commission.payout.createdAt")}>{props.createdAt}</Fact>
      </dl>
      <p className="mt-4 text-body text-primary">
        {t("commission.payout.entryCount", { count: payout.entryCount })}
      </p>
      {payout.note === null ? null : (
        <div className="mt-4 flex flex-col gap-1">
          <h3 className="text-small text-secondary">{t("commission.payout.note")}</h3>
          <p className="whitespace-pre-wrap text-body text-primary">{payout.note}</p>
        </div>
      )}
    </PageSection>
  );
}

/** `/{orgSlug}/commission/payouts/{commissionPayoutId}`: facts only; payouts have no void or edit (A2). */
export async function CommissionPayoutDetailPage(props: {
  orgSlug: string;
  commissionPayoutId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  if (!access.config.modules.includes(MODULE_KEY.COMMISSION)) notFound();
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.COMMISSION_PAYOUT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const data = await loadCommissionPayoutDetailData(access, props.commissionPayoutId);
  const createdAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: access.timeZone,
  }).format(new Date(data.payout.createdAt));
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        title={data.payout.payoutNumber}
        backHref={`/${props.orgSlug}/commission/payouts`}
        backLabel={t("commission.payout.back")}
        facts={<span>{formatMoney(data.payout.total, { locale })}</span>}
      />
      <PayoutFacts data={data} createdAt={createdAt} translator={translator} />
    </div>
  );
}

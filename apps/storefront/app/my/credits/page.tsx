import type { Locale, Translator } from "@banijjik/i18n";
import type {
  CreditPack,
  CreditPaymentInfoResponse,
  MyCreditsResponse,
} from "@banijjik/contracts/credit";
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { readAsVisitor, readSignedInCustomer } from "../../../src/api/storefront-api";
import { LazyCreditPurchaseSheet } from "../../../src/account/lazy-credit-purchase-sheet";
import { PurchaseCancelButton } from "../../../src/account/purchase-cancel-button";
import { requireSignedInCustomer } from "../../../src/account/require-customer";
import { localizedText } from "../../../src/i18n/localized-text";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { requireOrganizationId } from "../../../src/site/current-site";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const MY_CREDITS_PATH = "/my/credits";
const PENDING_STATUS = "PENDING";

interface PurchaseListItem {
  readonly creditPurchaseId: string;
  readonly purchaseNumber: string;
  readonly status: string;
  readonly snapshot: { readonly name: { readonly bn: string; readonly en: string } };
}

interface CreditsData {
  readonly credits: MyCreditsResponse | undefined;
  readonly packs: readonly CreditPack[];
  readonly payment: CreditPaymentInfoResponse | undefined;
  readonly purchases: readonly PurchaseListItem[];
}

async function readCreditsData(organizationId: string): Promise<CreditsData> {
  const base = `/orgs/${organizationId}`;
  const [credits, packs, payment, purchases] = await Promise.all([
    readSignedInCustomer<MyCreditsResponse>(`${base}/my/credits`),
    readAsVisitor<readonly CreditPack[]>(`${base}/credit-packs`),
    readSignedInCustomer<CreditPaymentInfoResponse>(`${base}/credit/payment-info`),
    readSignedInCustomer<{ readonly items: readonly PurchaseListItem[] }>(
      `${base}/my/credit-purchases`,
    ),
  ]);
  return { credits, packs: packs ?? [], payment, purchases: purchases?.items ?? [] };
}

/** Balance, packs to buy, payment info, purchase history and each purchase's status (M.6 decision 16). */
export default async function MyCreditsPage(): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  await requireSignedInCustomer(organizationId, MY_CREDITS_PATH);
  const { locale, translator } = await storefrontTranslator();
  const data = await readCreditsData(organizationId);
  return (
    <div className="flex flex-col gap-10">
      <BalanceSection balance={data.credits?.balance ?? 0} translator={translator} />
      <BuySection
        organizationId={organizationId}
        locale={locale}
        data={data}
        translator={translator}
      />
      <PurchasesSection
        organizationId={organizationId}
        locale={locale}
        purchases={data.purchases}
        translator={translator}
      />
      <HistorySection entries={data.credits?.entries ?? []} translator={translator} />
    </div>
  );
}

function BalanceSection({
  balance,
  translator,
}: {
  readonly balance: number;
  readonly translator: Translator;
}): ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-display font-semibold text-primary">
        {translator.t("storefront.credits.title")}
      </h1>
      <p className="text-title font-semibold text-primary">
        {translator.t("storefront.credits.balance", { count: balance })}
      </p>
    </section>
  );
}

function BuySection({
  organizationId,
  locale,
  data,
  translator,
}: {
  readonly organizationId: string;
  readonly locale: Locale;
  readonly data: CreditsData;
  readonly translator: Translator;
}): ReactElement {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title font-semibold text-primary">
        {translator.t("storefront.credits.buyTitle")}
      </h2>
      {data.packs.length === 0 || data.payment === undefined ? (
        <p className="text-body text-secondary">{translator.t("storefront.credits.noPacks")}</p>
      ) : (
        <LazyCreditPurchaseSheet
          organizationId={organizationId}
          locale={locale}
          packs={data.packs}
          methods={data.payment.methods}
        />
      )}
    </section>
  );
}

function PurchasesSection({
  organizationId,
  locale,
  purchases,
  translator,
}: {
  readonly organizationId: string;
  readonly locale: Locale;
  readonly purchases: readonly PurchaseListItem[];
  readonly translator: Translator;
}): ReactElement {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title font-semibold text-primary">
        {translator.t("storefront.credits.purchasesTitle")}
      </h2>
      {purchases.length === 0 ? (
        <p className="text-body text-secondary">{translator.t("storefront.credits.noPurchases")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {purchases.map((purchase) => (
            <PurchaseRow
              key={purchase.creditPurchaseId}
              organizationId={organizationId}
              locale={locale}
              purchase={purchase}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PurchaseRow({
  organizationId,
  locale,
  purchase,
}: {
  readonly organizationId: string;
  readonly locale: Locale;
  readonly purchase: PurchaseListItem;
}): ReactElement {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-default p-4">
      <span className="text-body text-primary">
        {purchase.purchaseNumber} · {localizedText(purchase.snapshot.name, locale)} ·{" "}
        {purchase.status}
      </span>
      {purchase.status === PENDING_STATUS ? (
        <PurchaseCancelButton
          organizationId={organizationId}
          creditPurchaseId={purchase.creditPurchaseId}
          locale={locale}
        />
      ) : null}
    </li>
  );
}

function HistorySection({
  entries,
  translator,
}: {
  readonly entries: MyCreditsResponse["entries"];
  readonly translator: Translator;
}): ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title font-semibold text-primary">
        {translator.t("storefront.credits.historyTitle")}
      </h2>
      <ul className="flex flex-col gap-2 text-body text-secondary">
        {entries.map((entry) => (
          <li key={entry.creditEntryId}>
            {entry.type} · {entry.credits} · {entry.businessDate}
          </li>
        ))}
      </ul>
    </section>
  );
}

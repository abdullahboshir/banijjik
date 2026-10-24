"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type {
  CommissionMemberSummaryResponse,
  CommissionPayoutResponse,
} from "@banijjik/contracts/commission";
import type { Translator } from "@banijjik/i18n";
import {
  DataList,
  EmptyState,
  formatMoney,
  type DataListColumn,
  type DisplayLocale,
} from "@banijjik/ui";
import { useLazyComponent, useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactElement } from "react";
import { payoutMethodLabelOf } from "./commission-labels";
import type { CommissionLocationOption } from "./commission-lookups";
import type { CommissionPaySheetProps } from "./commission-pay-sheet";
import { CommissionSummaryCards } from "./commission-summary-cards";

export interface CommissionPayoutsViewProps {
  organizationId: string;
  currency: CurrencyCode;
  payouts: readonly CommissionPayoutResponse[];
  summary: readonly CommissionMemberSummaryResponse[];
  locations: readonly CommissionLocationOption[];
  canPay: boolean;
  /** Today in the business's time zone. */
  defaultUpTo: string;
  detailBasePath: string;
}

async function loadPaySheet(): Promise<ComponentType<CommissionPaySheetProps>> {
  const sheetModule = await import("./commission-pay-sheet");
  return sheetModule.CommissionPaySheet;
}

function memberNamesOf(
  summary: readonly CommissionMemberSummaryResponse[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(summary.map((row) => [row.memberId, row.memberName]));
}

function payoutColumnsOf(
  memberNames: Readonly<Record<string, string>>,
  t: Translator["t"],
  locale: DisplayLocale,
): DataListColumn<CommissionPayoutResponse>[] {
  return [
    {
      columnKey: "number",
      header: t("commission.payouts.column.number"),
      isPrimary: true,
      cell: (payout) => payout.payoutNumber,
    },
    {
      columnKey: "member",
      header: t("commission.payouts.column.member"),
      isPrimary: true,
      cell: (payout) => memberNames[payout.memberId] ?? t("commission.rule.unknown"),
    },
    {
      columnKey: "total",
      header: t("commission.payouts.column.total"),
      isPrimary: true,
      align: "end",
      cell: (payout) => formatMoney(payout.total, { locale }),
    },
    {
      columnKey: "method",
      header: t("commission.payouts.column.method"),
      cell: (payout) => payoutMethodLabelOf(payout.method, t),
    },
    {
      columnKey: "date",
      header: t("commission.payouts.column.date"),
      cell: (payout) => payout.businessDate,
    },
  ];
}

/** Payout history plus a pay action from a member's open total; the pay sheet loads on the first tap. */
export function CommissionPayoutsView(props: CommissionPayoutsViewProps): ReactElement {
  const { t, locale } = useTranslator();
  const router = useRouter();
  const [payFor, setPayFor] = useState<{ memberId?: string | undefined } | undefined>();
  const PaySheet = useLazyComponent(loadPaySheet, payFor !== undefined);
  const memberNames = memberNamesOf(props.summary);
  const columns = payoutColumnsOf(memberNames, t, locale);
  return (
    <div className="flex flex-col gap-6">
      <CommissionSummaryCards
        rows={props.summary}
        onPay={props.canPay ? (memberId) => setPayFor({ memberId }) : undefined}
      />
      <DataList
        columns={columns}
        rows={[...props.payouts]}
        rowKey={(payout) => payout.commissionPayoutId}
        onRowSelect={(payout) =>
          router.push(`${props.detailBasePath}/${payout.commissionPayoutId}`)
        }
        emptyState={<EmptyState message={t("commission.payouts.empty")} />}
      />
      {PaySheet !== null && payFor !== undefined ? (
        <PaySheet
          organizationId={props.organizationId}
          currency={props.currency}
          members={props.summary.map((row) => ({
            memberId: row.memberId,
            name: row.memberName,
          }))}
          locations={props.locations}
          defaultMemberId={payFor.memberId}
          defaultUpTo={props.defaultUpTo}
          onClose={() => setPayFor(undefined)}
        />
      ) : null}
    </div>
  );
}

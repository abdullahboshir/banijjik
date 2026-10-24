"use client";

import type { CommissionMemberSummaryResponse } from "@banijjik/contracts/commission";
import { Button, formatMoney } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";

export interface CommissionSummaryCardsProps {
  rows: readonly CommissionMemberSummaryResponse[];
  /** On the payouts screen: each member's open total offers a payout. */
  onPay?: ((memberId: string) => void) | undefined;
}

function Amount(props: {
  label: string;
  money: CommissionMemberSummaryResponse["open"];
}): ReactElement {
  const { locale } = useTranslator();
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-secondary">{props.label}</span>
      <span className="text-body font-semibold text-primary">
        {formatMoney(props.money, { locale })}
      </span>
    </div>
  );
}

/** Open and paid commission per member, as cards (13-UX section 8: cards, never a wide table on a phone). */
export function CommissionSummaryCards(props: CommissionSummaryCardsProps): ReactElement {
  const { t } = useTranslator();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-title font-semibold text-primary">{t("commission.summary.title")}</h2>
        <p className="text-small text-secondary">{t("commission.summary.help")}</p>
      </div>
      {props.rows.length === 0 ? (
        <p className="text-body text-secondary">{t("commission.summary.empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {props.rows.map((row) => (
            <li
              key={row.memberId}
              className="flex flex-col gap-3 rounded-md border border-default bg-surface p-4 shadow-sm"
            >
              <span className="min-w-0 break-words text-body font-semibold text-primary">
                {row.memberName}
              </span>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Amount label={t("commission.summary.open")} money={row.open} />
                <Amount label={t("commission.summary.paid")} money={row.paidTotal} />
              </div>
              {props.onPay === undefined || row.open.amount <= 0 ? null : (
                <Button variant="secondary" onClick={() => props.onPay?.(row.memberId)}>
                  {t("commission.payouts.pay")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

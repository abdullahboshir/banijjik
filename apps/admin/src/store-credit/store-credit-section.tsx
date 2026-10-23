"use client";
import type { ReactElement } from "react";

import { PageSection, formatMoney } from "@banijjik/ui";
import dynamic from "next/dynamic";
import { StoreCreditAdjustForm } from "./store-credit-adjust-form";
import { StoreCreditHistory } from "./store-credit-history";
import type { StoreCreditProps } from "./store-credit-types";
import { useStoreCreditAdjustment } from "./use-store-credit-adjustment";

const Approval = dynamic(async () => (await import("./store-credit-approval")).StoreCreditApproval);

export function StoreCreditSection(props: StoreCreditProps): ReactElement {
  const adjustment = useStoreCreditAdjustment(props);
  return (
    <PageSection title={props.labels.title} help={props.labels.help}>
      <div className="flex flex-col gap-4">
        <dl>
          <dt>{props.labels.balance}</dt>
          <dd className="text-title font-semibold" data-store-credit-balance>
            {formatMoney(
              { amount: props.balanceMinor, currency: props.currency },
              { locale: props.locale },
            )}
          </dd>
        </dl>
        <StoreCreditHistory
          key={`${props.balanceMinor}-${props.entries[0]?.storeCreditEntryId ?? "empty"}`}
          {...props}
        />
        {props.canAdjust ? <StoreCreditAdjustForm {...props} adjustment={adjustment} /> : null}
        {adjustment.pending ? <Approval labels={props.labels} adjustment={adjustment} /> : null}
      </div>
    </PageSection>
  );
}

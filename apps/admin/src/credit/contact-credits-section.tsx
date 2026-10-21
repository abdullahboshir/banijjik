"use client";

import type { CreditAccountResponse } from "@banijjik/contracts/credit";
import { formatNumber, PageSection, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fillLabel } from "../catalog/catalog-labels";
import { AdjustForm, type ContactCreditsLocation } from "./contact-credits-adjust-form";
import { ContactCreditsApprovalDialog } from "./contact-credits-approval-dialog";
import { CreditEntryList } from "./contact-credits-entry-list";
import type { ContactCreditsLabels } from "./credit-labels";
import { useCreditAdjustment } from "./use-credit-adjustment";

export interface ContactCreditsSectionProps {
  organizationId: string;
  customerAccountId: string;
  account: CreditAccountResponse;
  canAdjust: boolean;
  /** An owner adjusts without an approval token (M.4 decision 6). */
  isOwner: boolean;
  /** The locations an approver may serve; empty when the caller needs no approval. */
  locations: readonly ContactCreditsLocation[];
  locale: DisplayLocale;
  timeZone: string;
  labels: ContactCreditsLabels;
}

/** Balance, ledger history and the staff adjustment of one customer's credits (M.4). */
export function ContactCreditsSection(props: ContactCreditsSectionProps): ReactElement {
  const { labels, account } = props;
  const adjustment = useCreditAdjustment(props);
  const needsApproval = !props.isOwner;
  const canSubmit = props.canAdjust && (!needsApproval || props.locations.length > 0);
  return (
    <PageSection title={labels.title} help={labels.help}>
      <div className="flex flex-col gap-4">
        <dl className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-small text-secondary">{labels.balance}</dt>
            <dd className="text-title font-semibold text-primary">
              {fillLabel(labels.balanceValue, {
                balance: formatNumber(account.balance, { locale: props.locale }),
              })}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2">
          <h3 className="text-body font-semibold text-primary">{labels.history}</h3>
          <CreditEntryList
            entries={account.entries}
            labels={labels}
            locale={props.locale}
            timeZone={props.timeZone}
          />
        </div>
        {canSubmit ? (
          <AdjustForm
            labels={labels}
            draft={adjustment.draft}
            onDraft={adjustment.setDraft}
            needsApproval={needsApproval}
            locations={props.locations}
            locationId={adjustment.locationId}
            onLocation={adjustment.setLocationId}
            isBusy={adjustment.isBusy}
            errorMessage={adjustment.formError}
            notice={adjustment.notice}
            onSubmit={() => void adjustment.submit()}
          />
        ) : null}
        {props.canAdjust && !canSubmit ? (
          <p className="text-body text-secondary">{labels.noLocations}</p>
        ) : null}
      </div>
      <ContactCreditsApprovalDialog labels={labels} approval={adjustment.approval} />
    </PageSection>
  );
}

"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import { CREDIT_PACK_STATUS, type CreditPack } from "@banijjik/contracts/credit";
import { Button, formatMoney, formatNumber, type DisplayLocale } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { fillLabel } from "../catalog/catalog-labels";
import { useRecordAction, type RecordAction } from "../catalog/use-record-action";
import type { CreditPackLabels } from "./credit-labels";
import { PackForm, type PackFormManager } from "./credit-pack-form";

export interface CreditPacksManagerProps {
  organizationId: string;
  packs: CreditPack[];
  currency: CurrencyCode;
  currencySymbol: string;
  locale: DisplayLocale;
  labels: CreditPackLabels;
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
}

function Failure(props: { action: RecordAction; labels: CreditPackLabels }): ReactElement | null {
  const { t } = useTranslator();
  const { failure } = props.action;
  if (!failure) return null;
  if (failure.isConflict) {
    return (
      <div role="alert" className="flex flex-col gap-2 text-small text-danger">
        <p>{props.labels.conflict}</p>
        <Button variant="secondary" onClick={props.action.reload}>
          {props.labels.reload}
        </Button>
      </div>
    );
  }
  return (
    <p role="alert" className="text-small text-danger">
      {t(knownMessageKeyOrInternal(failure.messageKey ?? "errors.internal"))}
    </p>
  );
}

function packNameOf(pack: CreditPack, locale: DisplayLocale): string {
  const text = pack.name[locale].trim();
  return text.length > 0 ? text : (locale === "bn" ? pack.name.en : pack.name.bn).trim();
}

function validityTextOf(pack: CreditPack, props: CreditPacksManagerProps): string {
  if (pack.validityDays === null) return props.labels.neverExpires;
  return fillLabel(props.labels.expiresAfter, {
    days: formatNumber(pack.validityDays, { locale: props.locale }),
  });
}

function PackSummary(props: {
  pack: CreditPack;
  manager: CreditPacksManagerProps;
  onEdit: () => void;
}): ReactElement {
  const { pack, manager } = props;
  const summary = fillLabel(manager.labels.summary, {
    credits: formatNumber(pack.credits, { locale: manager.locale }),
    price: formatMoney(pack.price, { locale: manager.locale }),
  });
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-default p-3">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="break-words text-body font-semibold text-primary">
            {packNameOf(pack, manager.locale)}
          </span>
          <span className="text-small text-secondary">{manager.labels.status[pack.status]}</span>
        </span>
        <span className="text-small text-secondary">{summary}</span>
        <span className="text-small text-secondary">{validityTextOf(pack, manager)}</span>
      </span>
      {manager.canUpdate && pack.status === CREDIT_PACK_STATUS.ACTIVE ? (
        <Button variant="secondary" onClick={props.onEdit}>
          {manager.labels.edit}
        </Button>
      ) : null}
    </li>
  );
}

/** The credit packs: a list, and one form at a time to add or change a pack (M.4). */
export function CreditPacksManager(props: CreditPacksManagerProps): ReactElement {
  const { labels, packs } = props;
  const action = useRecordAction();
  const [openId, setOpenId] = useState<string | undefined>();
  const close = (): void => setOpenId(undefined);
  const formManager: PackFormManager = {
    organizationId: props.organizationId,
    currency: props.currency,
    currencySymbol: props.currencySymbol,
    canArchive: props.canArchive,
    labels,
  };
  return (
    <div className="flex flex-col gap-4">
      {props.canCreate && openId !== "new" ? (
        <Button onClick={() => setOpenId("new")}>{labels.add}</Button>
      ) : null}
      {openId === "new" ? (
        <PackForm manager={formManager} pack={undefined} action={action} onClose={close} />
      ) : null}
      <Failure action={action} labels={labels} />
      {packs.length === 0 ? (
        <p className="text-body text-secondary">{labels.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {packs.map((pack) =>
            openId === pack.creditPackId ? (
              <li key={pack.creditPackId}>
                <PackForm manager={formManager} pack={pack} action={action} onClose={close} />
              </li>
            ) : (
              <PackSummary
                key={pack.creditPackId}
                pack={pack}
                manager={props}
                onEdit={() => setOpenId(pack.creditPackId)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

"use client";

import type { CategoryResponse } from "@banijjik/contracts/catalog";
import type { PromotionResponse } from "@banijjik/contracts/pricing";
import { Button } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { useRecordAction, type RecordAction } from "../catalog/use-record-action";
import { AddPromotion } from "./add-promotion";
import { archivePromotion, updatePromotion } from "./pricing-api";
import type { PromotionLabels } from "./pricing-labels";
import { PreviewPanel, type PreviewOfferingChoice } from "./preview-panel";

export type { PreviewOfferingChoice };

export interface PromotionsManagerProps {
  organizationId: string;
  promotions: PromotionResponse[];
  categories: readonly CategoryResponse[];
  locations: readonly { locationId: string; name: string }[];
  offerings: readonly PreviewOfferingChoice[];
  labels: PromotionLabels;
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
}

function Failure(props: { action: RecordAction; labels: PromotionLabels }): ReactElement | null {
  const { t } = useTranslator();
  const { failure } = props.action;
  if (!failure) return null;
  if (failure.isConflict) {
    return (
      <div role="alert" className="flex flex-col gap-2 text-small text-danger">
        <p>{props.labels["promotions.conflict"]}</p>
        <Button variant="secondary" onClick={props.action.reload}>
          {props.labels["promotions.reload"]}
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

function statusLabel(status: PromotionResponse["status"], labels: PromotionLabels): string {
  if (status === "DRAFT") return labels["promotions.status.DRAFT"];
  if (status === "ACTIVE") return labels["promotions.status.ACTIVE"];
  return labels["promotions.status.ARCHIVED"];
}

function PromotionRow(props: {
  row: PromotionResponse;
  organizationId: string;
  labels: PromotionLabels;
  action: RecordAction;
  canUpdate: boolean;
  canArchive: boolean;
}): ReactElement {
  const { row, organizationId, labels, action, canUpdate, canArchive } = props;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-default p-3">
      <span className="flex min-w-0 flex-col">
        <span className="break-words text-body font-semibold text-primary">{row.name}</span>
        <span className="text-small text-secondary">
          {statusLabel(row.status, labels)} · {row.target.scope}
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        {canUpdate && row.status === "DRAFT" ? (
          <Button
            variant="secondary"
            onClick={() =>
              void action.run(() =>
                updatePromotion(organizationId, row.promotionId, {
                  version: row.version,
                  status: "ACTIVE",
                }),
              )
            }
          >
            {labels["promotions.activate"]}
          </Button>
        ) : null}
        {canArchive && row.status !== "ARCHIVED" ? (
          <Button
            variant="secondary"
            onClick={() =>
              void action.run(() => archivePromotion(organizationId, row.promotionId, row.version))
            }
          >
            {labels["promotions.archive"]}
          </Button>
        ) : null}
      </span>
    </li>
  );
}

/** Promotions list with create, activate, archive and a quote preview (card 3.4). */
export function PromotionsManager(props: PromotionsManagerProps): ReactElement {
  const {
    labels,
    promotions,
    organizationId,
    categories,
    locations,
    offerings,
    canCreate,
    canUpdate,
    canArchive,
  } = props;
  const action = useRecordAction();
  return (
    <div className="flex flex-col gap-4">
      {canCreate ? (
        <AddPromotion
          organizationId={organizationId}
          categories={categories}
          labels={labels}
          action={action}
        />
      ) : null}
      <PreviewPanel
        organizationId={organizationId}
        locations={locations}
        offerings={offerings}
        labels={labels}
      />
      <Failure action={action} labels={labels} />
      {promotions.length === 0 ? (
        <p className="text-body text-secondary">{labels["promotions.empty"]}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {promotions.map((row) => (
            <PromotionRow
              key={row.promotionId}
              row={row}
              organizationId={organizationId}
              labels={labels}
              action={action}
              canUpdate={canUpdate}
              canArchive={canArchive}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

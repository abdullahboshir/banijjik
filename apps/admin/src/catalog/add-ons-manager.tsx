"use client";

import type { Money, ModifierGroupResponse } from "@banijjik/contracts/catalog";
import { Button } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { GroupForm } from "./add-on-group-form";
import { fillLabel } from "./catalog-labels";
import type { AddOnLabels } from "./manager-labels";
import { useRecordAction, type RecordAction } from "./use-record-action";

export interface AddOnsManagerProps {
  organizationId: string;
  groups: ModifierGroupResponse[];
  currency: Money["currency"];
  currencySymbol: string;
  labels: AddOnLabels;
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
}

function Failure(props: { action: RecordAction; labels: AddOnLabels }): ReactElement | null {
  const { t } = useTranslator();
  const { failure } = props.action;
  if (!failure) return null;
  if (failure.isConflict) {
    return (
      <div role="alert" className="flex flex-col gap-2 text-small text-danger">
        <p>{props.labels["addOns.conflict"]}</p>
        <Button variant="secondary" onClick={props.action.reload}>
          {props.labels["addOns.reload"]}
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

function GroupSummary(props: {
  group: ModifierGroupResponse;
  labels: AddOnLabels;
  canUpdate: boolean;
  onEdit: () => void;
}): ReactElement {
  const { group, labels } = props;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-default p-3">
      <span className="flex min-w-0 flex-col">
        <span className="break-words text-body font-semibold text-primary">{group.name}</span>
        <span className="text-small text-secondary">
          {fillLabel(labels["addOns.optionsCount"], { count: group.options.length })}
        </span>
      </span>
      {props.canUpdate ? (
        <Button variant="secondary" onClick={props.onEdit}>
          {labels["addOns.edit"]}
        </Button>
      ) : null}
    </li>
  );
}

/** The add-on groups: a list, and one form at a time to add or change a group (ADR-072). */
export function AddOnsManager(props: AddOnsManagerProps): ReactElement {
  const { labels, groups } = props;
  const action = useRecordAction();
  const [openId, setOpenId] = useState<string | undefined>();
  const close = (): void => setOpenId(undefined);
  return (
    <div className="flex flex-col gap-4">
      {props.canCreate && openId !== "new" ? (
        <Button onClick={() => setOpenId("new")}>{labels["addOns.add"]}</Button>
      ) : null}
      {openId === "new" ? (
        <GroupForm manager={props} group={undefined} action={action} onClose={close} />
      ) : null}
      <Failure action={action} labels={labels} />
      {groups.length === 0 ? (
        <p className="text-body text-secondary">{labels["addOns.empty"]}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) =>
            openId === group.modifierGroupId ? (
              <li key={group.modifierGroupId}>
                <GroupForm manager={props} group={group} action={action} onClose={close} />
              </li>
            ) : (
              <GroupSummary
                key={group.modifierGroupId}
                group={group}
                labels={labels}
                canUpdate={props.canUpdate}
                onEdit={() => setOpenId(group.modifierGroupId)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

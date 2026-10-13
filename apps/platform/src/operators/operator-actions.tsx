"use client";

import { Button } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement } from "react";
import type { OperatorFormSheetProps } from "./operator-form-sheet";
import type { OperatorStatusSheetProps } from "./operator-status-sheet";
import type { PlatformRole } from "@banijjik/contracts";
import type { OperatorActionKind, OperatorLabels } from "./operator-action-rules";

export interface OperatorActionTarget {
  platformOperatorId: string;
  version: number;
  platformRoles: readonly PlatformRole[];
  actions: OperatorActionKind[];
}

const VARIANT: Record<OperatorActionKind, "primary" | "secondary" | "danger"> = {
  changeRoles: "secondary",
  disable: "danger",
  enable: "primary",
};

const ACTION_LABEL_KEY = {
  changeRoles: "platform.action.changeRoles",
  disable: "platform.action.disableOperator",
  enable: "platform.action.enableOperator",
} as const;

async function loadFormSheet(): Promise<ComponentType<OperatorFormSheetProps>> {
  const sheetModule = await import("./operator-form-sheet");
  return sheetModule.OperatorFormSheet;
}

async function loadStatusSheet(): Promise<ComponentType<OperatorStatusSheetProps>> {
  const sheetModule = await import("./operator-status-sheet");
  return sheetModule.OperatorStatusSheet;
}

/** The header button. The add sheet loads on the first tap. */
export function OperatorAddButton({ labels }: { labels: OperatorLabels }): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const Sheet = useLazyComponent(loadFormSheet, isOpen);
  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        {labels["platform.action.addOperator"]}
      </Button>
      {Sheet && isOpen ? (
        <Sheet target={{ kind: "create" }} labels={labels} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}

/** The buttons of one row that is not the caller's own. Sheets load on the first tap. */
export function OperatorRowActions({
  row,
  labels,
}: {
  row: OperatorActionTarget;
  labels: OperatorLabels;
}): ReactElement | null {
  const [openKind, setOpenKind] = useState<OperatorActionKind | undefined>();
  const needsForm = openKind === "changeRoles";
  const needsStatus = openKind === "disable" || openKind === "enable";
  const FormSheet = useLazyComponent(loadFormSheet, needsForm);
  const StatusSheet = useLazyComponent(loadStatusSheet, needsStatus);
  if (row.actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {row.actions.map((kind) => (
        <Button key={kind} variant={VARIANT[kind]} onClick={() => setOpenKind(kind)}>
          {labels[ACTION_LABEL_KEY[kind]]}
        </Button>
      ))}
      {FormSheet && needsForm ? (
        <FormSheet
          target={{
            kind: "roles",
            platformOperatorId: row.platformOperatorId,
            version: row.version,
            platformRoles: row.platformRoles,
          }}
          labels={labels}
          onClose={() => setOpenKind(undefined)}
        />
      ) : null}
      {StatusSheet && (openKind === "disable" || openKind === "enable") ? (
        <StatusSheet
          action={openKind}
          platformOperatorId={row.platformOperatorId}
          version={row.version}
          labels={labels}
          onClose={() => setOpenKind(undefined)}
        />
      ) : null}
    </div>
  );
}

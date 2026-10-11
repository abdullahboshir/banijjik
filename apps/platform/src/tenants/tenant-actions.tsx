"use client";

import { Button } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import { useLazyComponent } from "../lib/use-lazy-component";
import type { TenantActionContext, TenantActionKind } from "./tenant-action-labels";
import type { TenantActionSheetProps } from "./tenant-action-sheet";

export interface TenantActionsProps {
  /** Only the actions this operator may do now (permission, tenant state); the API checks again. */
  actions: TenantActionKind[];
  context: TenantActionContext;
}

async function loadSheet(): Promise<ComponentType<TenantActionSheetProps>> {
  const sheetModule = await import("./tenant-action-sheet");
  return sheetModule.TenantActionSheet;
}

const VARIANT: Record<TenantActionKind, "primary" | "secondary" | "danger"> = {
  suspend: "danger",
  reactivate: "primary",
  extendTrial: "secondary",
  changePackage: "secondary",
  grantModule: "secondary",
  revokeModule: "secondary",
};

/** The action buttons of a tenant's page. The sheets and their forms load on the first tap. */
export function TenantActions({ actions, context }: TenantActionsProps): ReactElement | null {
  const [openKind, setOpenKind] = useState<TenantActionKind | undefined>();
  const Sheet = useLazyComponent(loadSheet, openKind !== undefined);
  if (actions.length === 0) return null;
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {actions.map((kind) => (
          <Button key={kind} variant={VARIANT[kind]} onClick={() => setOpenKind(kind)}>
            {context.labels[`platform.action.${kind}`]}
          </Button>
        ))}
      </div>
      {Sheet && openKind ? (
        <Sheet kind={openKind} context={context} onClose={() => setOpenKind(undefined)} />
      ) : null}
    </>
  );
}

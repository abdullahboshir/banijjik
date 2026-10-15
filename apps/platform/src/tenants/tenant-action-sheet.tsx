"use client";

import type { ReactElement } from "react";
import { ChangeIndustrySheet } from "./change-industry-sheet";
import { ChangePackageSheet } from "./change-package-sheet";
import { ExtendTrialSheet } from "./extend-trial-sheet";
import { OverrideSheet } from "./override-sheet";
import { StatusSheet } from "./status-sheet";
import type { TenantActionContext, TenantActionKind } from "./tenant-action-labels";

export interface TenantActionSheetProps {
  kind: TenantActionKind;
  context: TenantActionContext;
  onClose: () => void;
}

/** The sheet of one tenant action. This module is loaded on the first tap, so none of it is in the first load. */
export function TenantActionSheet({
  kind,
  context,
  onClose,
}: TenantActionSheetProps): ReactElement {
  switch (kind) {
    case "suspend":
    case "reactivate":
      return <StatusSheet action={kind} context={context} onClose={onClose} />;
    case "extendTrial":
      return <ExtendTrialSheet context={context} onClose={onClose} />;
    case "changePackage":
      return <ChangePackageSheet context={context} onClose={onClose} />;
    case "grantModule":
    case "revokeModule":
      return <OverrideSheet kind={kind} context={context} onClose={onClose} />;
    case "changeIndustry":
      return <ChangeIndustrySheet context={context} onClose={onClose} />;
  }
}

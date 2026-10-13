"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import { Button } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import type { ArchivePackageDialogProps } from "./archive-package-dialog";
import type { PackageFormLabels } from "./package-form-labels";

export interface ArchivePackageButtonProps {
  packageId: string;
  version: number;
  labels: PackageFormLabels;
}

async function loadDialog(): Promise<ComponentType<ArchivePackageDialogProps>> {
  const dialogModule = await import("./archive-package-dialog");
  return dialogModule.ArchivePackageDialog;
}

/** The "Archive" button of a package; the confirmation loads on the first tap. */
export function ArchivePackageButton(props: ArchivePackageButtonProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const Dialog = useLazyComponent(loadDialog, isOpen);
  return (
    <>
      <Button variant="danger" onClick={() => setIsOpen(true)}>
        {props.labels["platform.package.archive"]}
      </Button>
      {Dialog && isOpen ? <Dialog {...props} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}

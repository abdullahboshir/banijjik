"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { ConfirmDialog } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { archivePackage } from "../api/platform-api";
import { announceSuccess } from "../forms/announce-success";
import { useFormSubmit } from "../forms/use-form-submit";
import type { PackageFormLabels } from "./package-form-labels";

export interface ArchivePackageDialogProps {
  packageId: string;
  version: number;
  labels: PackageFormLabels;
  onClose: () => void;
}

/** Confirmation of archiving a package. A refusal, such as "still in use", replaces the description. */
export function ArchivePackageDialog(props: ArchivePackageDialogProps): ReactElement {
  const { packageId, version, labels, onClose } = props;
  const { t } = useTranslator();
  const router = useRouter();
  const submit = useFormSubmit();

  async function handleConfirm(): Promise<void> {
    if (!(await submit.run(() => archivePackage(packageId, version)))) return;
    onClose();
    router.replace("/packages");
    await announceSuccess(labels["platform.package.archived"]);
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={labels["platform.package.archiveTitle"]}
      description={
        submit.failure
          ? t(submit.failure.messageKey, submit.failure.values)
          : labels["platform.package.archiveDescription"]
      }
      confirmLabel={labels["platform.package.archive"]}
      cancelLabel={t("common.cancel")}
      closeLabel={t("shell.closeMenu")}
      tone="danger"
      onConfirm={() => void handleConfirm()}
    />
  );
}

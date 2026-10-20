import type { Translator } from "@banijjik/i18n";
import type { ReviewActionsLabels } from "./review-actions";

export function reviewActionLabelsOf(t: Translator["t"]): ReviewActionsLabels {
  return {
    approve: t("directory.action.approve"),
    approveConfirmTitle: t("directory.action.approveConfirmTitle"),
    approveConfirmDescription: t("directory.action.approveConfirmDescription"),
    reject: t("directory.action.reject"),
    hide: t("directory.action.hide"),
    unhide: t("directory.action.unhide"),
    confirm: t("common.confirm"),
    cancel: t("common.cancel"),
    close: t("shell.closeMenu"),
    versionConflict: t("directory.review.versionConflict"),
    checklistTitle: t("directory.checklist.title"),
    checklistHelp: t("directory.checklist.help"),
    noneApply: t("directory.checklist.noneApply"),
    rejectForm: {
      title: t("directory.reject.title"),
      reasons: t("directory.reject.reasons"),
      finalMark: t("directory.reject.finalMark"),
      note: t("directory.reject.note"),
      submit: t("directory.reject.submit"),
      cancel: t("common.cancel"),
      reasonRequired: t("directory.reject.reasonRequired"),
    },
  };
}

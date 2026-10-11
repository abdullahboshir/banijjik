import type { Translator } from "@banijjik/i18n";
import type { AssignmentLabels } from "./assignment-labels";
import type { MemberActionLabels } from "./member-action-labels";

export function assignmentLabelsOf(t: Translator["t"]): AssignmentLabels {
  return {
    row: t("staff.assignment.row"),
    role: t("staff.assignment.role"),
    location: t("staff.assignment.location"),
    chooseRole: t("staff.assignment.chooseRole"),
    chooseLocation: t("staff.assignment.chooseLocation"),
    add: t("staff.assignment.add"),
    remove: t("staff.assignment.remove"),
    duplicate: t("staff.assignment.duplicate"),
  };
}

/** Text of the member actions; the member's name is filled into the confirmation titles here. */
export function memberActionLabelsOf(t: Translator["t"], name: string): MemberActionLabels {
  return {
    group: t("staff.detail.actions"),
    actions: {
      editAssignments: t("staff.action.editAssignments"),
      suspend: t("staff.action.suspend"),
      reactivate: t("staff.action.reactivate"),
      remove: t("staff.action.remove"),
    },
    confirm: {
      suspend: {
        title: t("staff.confirm.suspend.title", { name }),
        description: t("staff.confirm.suspend.description"),
      },
      reactivate: {
        title: t("staff.confirm.reactivate.title", { name }),
        description: t("staff.confirm.reactivate.description"),
      },
      remove: {
        title: t("staff.confirm.remove.title", { name }),
        description: t("staff.confirm.remove.description"),
      },
    },
    cancel: t("common.cancel"),
    close: t("shell.closeMenu"),
    save: t("common.save"),
    conflict: t("staff.conflict"),
    reload: t("staff.reload"),
    assignments: assignmentLabelsOf(t),
  };
}

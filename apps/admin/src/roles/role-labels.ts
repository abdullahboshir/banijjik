import type { Translator } from "@banijjik/i18n";
import type { PermissionGroup } from "./permission-groups";

/** A group as the client form draws it: the select-all text is already filled in. */
export interface RoleFormGroup extends PermissionGroup {
  selectAllLabel: string;
}

export interface RoleFormLabels {
  createTitle: string;
  editTitle: string;
  close: string;
  submit: string;
  conflict: string;
  reload: string;
  name: string;
  permissions: string;
  heldHint: string;
  notHeld: string;
  sensitiveGroup: string;
  sensitiveMark: string;
}

export interface RoleArchiveLabels {
  title: string;
  description: string;
  /** Shown when the role is still held: says how many members and what to do. */
  inUse: string;
  confirm: string;
  cancel: string;
  close: string;
  conflict: string;
}

export function roleFormGroupsOf(groups: PermissionGroup[], t: Translator["t"]): RoleFormGroup[] {
  return groups.map((group) => ({
    ...group,
    selectAllLabel: t("roles.form.selectAll", { group: group.label }),
  }));
}

export function roleFormLabelsOf(t: Translator["t"]): RoleFormLabels {
  return {
    createTitle: t("roles.form.create.title"),
    editTitle: t("roles.form.edit.title"),
    close: t("shell.closeMenu"),
    submit: t("common.save"),
    conflict: t("settings.conflict"),
    reload: t("settings.reload"),
    name: t("roles.field.name"),
    permissions: t("roles.form.permissions"),
    heldHint: t("roles.form.heldHint"),
    notHeld: t("roles.form.notHeld"),
    sensitiveGroup: t("roles.sensitive.group"),
    sensitiveMark: t("roles.sensitive.mark"),
  };
}

export function roleArchiveLabelsOf(
  t: Translator["t"],
  role: { name: string; memberCount: number },
): RoleArchiveLabels {
  return {
    title: t("roles.archive.title", { name: role.name }),
    description: t("roles.archive.description"),
    inUse: t("roles.archive.inUse", { count: role.memberCount }),
    confirm: t("roles.archive"),
    cancel: t("common.cancel"),
    close: t("shell.closeMenu"),
    conflict: t("settings.conflict"),
  };
}

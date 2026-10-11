"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { Button, Checkbox, Sheet, SheetContent } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { knownMessageKeyOrInternal, type FieldErrors } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { ConflictNotice } from "../settings/conflict-notice";
import { failureOfApiError, NO_FAILURE, type FormFailure } from "../settings/form-failure";
import { FormMessage } from "../settings/form-message";
import { SettingsTextField } from "../settings/settings-text-field";
import type { PermissionItem } from "./permission-groups";
import { createRole, updateRole } from "./role-api";
import { buildRoleCreate, buildRoleUpdate } from "./role-form";
import type { RoleFormGroup, RoleFormLabels } from "./role-labels";

/** The role being edited; absent when the sheet creates one. */
export interface EditedRole {
  roleId: string;
  /** The version the page was drawn from; a stale one is refused with a 409. */
  version: number;
}

export interface RoleFormSheetProps {
  organizationId: string;
  initialName: string;
  groups: RoleFormGroup[];
  /** Permissions of the role that the form cannot show (their module is off); they are kept as they are. */
  preservedKeys?: string[];
  role?: EditedRole;
  labels: RoleFormLabels;
  onClose: () => void;
}

const FIELD_NAMES = ["name"];

function selectedKeysOf(groups: readonly RoleFormGroup[]): Set<string> {
  const items = groups.flatMap((group) => [...group.regular, ...group.sensitive]);
  return new Set(items.filter((item) => item.isSelected).map((item) => item.permissionKey));
}

/** A role name that is already taken is a DUPLICATE on the name field, in the role's own words. */
function failureOfRoleError(error: ApiError): FormFailure {
  if (error.code !== ERROR_CODE.DUPLICATE) return failureOfApiError(error, FIELD_NAMES);
  const messageKey = knownMessageKeyOrInternal(error.messageKey);
  return { ...NO_FAILURE, fieldErrors: { name: messageKey } };
}

function useRoleSubmit(props: RoleFormSheetProps, name: string, selected: ReadonlySet<string>) {
  const { organizationId, role } = props;
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  const [isSaving, setIsSaving] = useState(false);

  async function send(): Promise<boolean> {
    const keys = [...selected, ...(props.preservedKeys ?? [])];
    if (role) {
      const update = buildRoleUpdate(name, keys, role.version);
      if (!update.ok) return rejectForm(update.fieldErrors);
      await updateRole(organizationId, role.roleId, update.body);
      return true;
    }
    const create = buildRoleCreate(name, keys);
    if (!create.ok) return rejectForm(create.fieldErrors);
    await createRole(organizationId, create.body);
    return true;
  }

  function rejectForm(fieldErrors: FieldErrors): boolean {
    setErrors(fieldErrors);
    return false;
  }

  async function submit(): Promise<void> {
    setErrors({});
    setFailure(NO_FAILURE);
    setIsSaving(true);
    try {
      if (await send()) {
        props.onClose();
        router.refresh();
        return;
      }
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const refused = failureOfRoleError(error);
      setErrors(refused.fieldErrors);
      setFailure(refused);
    }
    setIsSaving(false);
  }

  return { errors, failure, isSaving, submit, reload: () => router.refresh() };
}

function ItemCheckboxes({
  items,
  selected,
  onToggle,
}: {
  items: PermissionItem[];
  selected: ReadonlySet<string>;
  onToggle: (permissionKey: string) => void;
}): ReactElement {
  return (
    <>
      {items.map((item) => (
        <Checkbox
          key={item.permissionKey}
          label={item.label}
          checked={selected.has(item.permissionKey)}
          disabled={!item.isHeld}
          onChange={() => onToggle(item.permissionKey)}
        />
      ))}
    </>
  );
}

interface GroupFieldsProps {
  group: RoleFormGroup;
  labels: RoleFormLabels;
  selected: ReadonlySet<string>;
  onToggle: (permissionKey: string) => void;
  onToggleGroup: (items: PermissionItem[], isOn: boolean) => void;
}

function GroupFields({
  group,
  labels,
  selected,
  onToggle,
  onToggleGroup,
}: GroupFieldsProps): ReactElement {
  const offered = group.regular.filter((item) => item.isHeld);
  const isAllOn = offered.length > 0 && offered.every((item) => selected.has(item.permissionKey));
  const hasLocked = [...group.regular, ...group.sensitive].some((item) => !item.isHeld);
  return (
    <fieldset className="flex flex-col gap-1 rounded-md border border-default p-3">
      <legend className="px-1 text-body font-semibold text-primary">{group.label}</legend>
      {offered.length > 0 ? (
        <Checkbox
          label={group.selectAllLabel}
          checked={isAllOn}
          onChange={() => onToggleGroup(offered, !isAllOn)}
        />
      ) : null}
      <ItemCheckboxes items={group.regular} selected={selected} onToggle={onToggle} />
      {group.sensitive.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1 border-t border-default pt-2">
          <p className="text-small font-semibold text-warning">{labels.sensitiveGroup}</p>
          <ItemCheckboxes items={group.sensitive} selected={selected} onToggle={onToggle} />
        </div>
      ) : null}
      {hasLocked ? <p className="text-small text-secondary">{labels.notHeld}</p> : null}
    </fieldset>
  );
}

function RoleForm(props: RoleFormSheetProps): ReactElement {
  const { labels, groups } = props;
  const [name, setName] = useState(props.initialName);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => selectedKeysOf(groups));
  const state = useRoleSubmit(props, name, selected);

  function toggle(permissionKey: string): void {
    const next = new Set(selected);
    if (!next.delete(permissionKey)) next.add(permissionKey);
    setSelected(next);
  }

  function toggleGroup(items: PermissionItem[], isOn: boolean): void {
    const next = new Set(selected);
    for (const item of items) {
      if (isOn) next.add(item.permissionKey);
      else next.delete(item.permissionKey);
    }
    setSelected(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <SettingsTextField
        fieldId="role-name"
        label={labels.name}
        value={name}
        errorKey={state.errors["name"]}
        isRequired
        onChange={setName}
      />
      <h3 className="text-title font-semibold text-primary">{labels.permissions}</h3>
      <p className="text-small text-secondary">{labels.heldHint}</p>
      {groups.map((group) => (
        <GroupFields
          key={group.moduleKey}
          group={group}
          labels={labels}
          selected={selected}
          onToggle={toggle}
          onToggleGroup={toggleGroup}
        />
      ))}
      {state.failure.isConflict ? (
        <ConflictNotice
          message={labels.conflict}
          reloadLabel={labels.reload}
          onReload={state.reload}
        />
      ) : null}
      <FormMessage failure={state.failure} />
      <Button type="submit" isLoading={state.isSaving}>
        {labels.submit}
      </Button>
    </form>
  );
}

/** Loaded on the first tap of "New role" or "Edit": a name and the permissions grouped by module. */
export function RoleFormSheet(props: RoleFormSheetProps): ReactElement {
  const title = props.role ? props.labels.editTitle : props.labels.createTitle;
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={title} closeLabel={props.labels.close}>
        <RoleForm {...props} />
      </SheetContent>
    </Sheet>
  );
}

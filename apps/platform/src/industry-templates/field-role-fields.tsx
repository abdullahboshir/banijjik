"use client";

import type { ContactRole, IndustryTemplateCustomField } from "@banijjik/contracts";
import { Checkbox, FormField } from "@banijjik/ui";
import type { ReactElement } from "react";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";

/** The roles a contact field belongs to, chosen among the template's roles; nothing chosen means every role (ADR-113). */
export function RoleFields(props: {
  draft: IndustryTemplateCustomField;
  contactRoleKeys: readonly ContactRole[];
  labels: IndustryLabels;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const { draft } = props;
  const chosen = draft.appliesToContactRoles ?? [];

  function toggle(role: ContactRole, isOn: boolean): void {
    const next = isOn ? [...chosen, role] : chosen.filter((item) => item !== role);
    props.onChange(withRoles(draft, next));
  }

  return (
    <FormField
      label={t("platform.industry.field.appliesToRoles")}
      htmlFor="field-roles"
      hint={t("platform.industry.field.allRoles")}
    >
      <div id="field-roles" className="flex flex-col gap-2">
        {props.contactRoleKeys.map((role) => (
          <Checkbox
            key={role}
            label={t(`platform.contactRole.${role}`)}
            checked={chosen.includes(role)}
            onChange={(event) => toggle(role, event.target.checked)}
          />
        ))}
      </div>
    </FormField>
  );
}

/** The field with these roles; an empty choice removes the property, which means every role. */
function withRoles(
  draft: IndustryTemplateCustomField,
  roles: readonly ContactRole[],
): IndustryTemplateCustomField {
  const rest: Record<string, unknown> = { ...draft };
  delete rest["appliesToContactRoles"];
  // Safe: the copy has every property of the draft except the roles.
  const withoutRoles = rest as unknown as IndustryTemplateCustomField;
  return roles.length === 0 ? withoutRoles : { ...withoutRoles, appliesToContactRoles: roles };
}

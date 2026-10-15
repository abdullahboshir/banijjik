"use client";

import {
  CONTACT_ROLE,
  RELATION_KEY,
  type ContactRole,
  type IndustryTemplateConfiguration,
  type IndustryTemplateResourceType,
  type RelationKey,
} from "@banijjik/contracts";
import { Button, Checkbox, FormField, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { IndustrySection } from "./industry-section";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import { writeConfiguration } from "./write-configuration";
import type { TemplatePatch } from "./use-template-save";

function ChoiceList<Value extends string>(props: {
  values: readonly Value[];
  selected: readonly Value[];
  locked: readonly Value[];
  canWrite: boolean;
  labelOf: (value: Value) => string;
  onChange: (selected: Value[]) => void;
}): ReactElement {
  return (
    <>
      {props.values.map((value) => (
        <Checkbox
          key={value}
          label={props.labelOf(value)}
          checked={props.selected.includes(value)}
          disabled={!props.canWrite || props.locked.includes(value)}
          onChange={(event) =>
            props.onChange(toggleValue(props.selected, value, event.target.checked))
          }
        />
      ))}
    </>
  );
}

function toggleValue<Value extends string>(
  selected: readonly Value[],
  value: Value,
  checked: boolean,
): Value[] {
  if (checked) return selected.includes(value) ? [...selected] : [...selected, value];
  return selected.filter((item) => item !== value);
}

interface RolesSectionProps {
  configuration: IndustryTemplateConfiguration;
  canWrite: boolean;
  refusesRemoval: boolean;
  labels: IndustryLabels;
  onSave: (patch: TemplatePatch) => void;
}

export function RolesSection(props: RolesSectionProps): ReactElement {
  const t = labelsTranslator(props.labels);
  const [roles, setRoles] = useState<ContactRole[]>([...props.configuration.contactRoleKeys]);
  const [relations, setRelations] = useState<RelationKey[]>([...props.configuration.relationKeys]);
  const [resources, setResources] = useState<IndustryTemplateResourceType[]>([
    ...props.configuration.resourceTypes,
  ]);
  return (
    <IndustrySection title={t("platform.industry.section.roles")}>
      <ChoiceList
        values={Object.values(CONTACT_ROLE)}
        selected={roles}
        locked={props.refusesRemoval ? props.configuration.contactRoleKeys : []}
        canWrite={props.canWrite}
        labelOf={(role) => t(`platform.contactRole.${role}`)}
        onChange={setRoles}
      />
      <ChoiceList
        values={Object.values(RELATION_KEY)}
        selected={relations}
        locked={props.refusesRemoval ? props.configuration.relationKeys : []}
        canWrite={props.canWrite}
        labelOf={(relation) => t(`platform.relation.${relation}`)}
        onChange={setRelations}
      />
      <ResourceEditor
        resources={resources}
        canWrite={props.canWrite}
        refusesRemoval={props.refusesRemoval}
        originalKeys={
          new Set(props.configuration.resourceTypes.map((resource) => resource.resourceTypeKey))
        }
        labels={props.labels}
        onResources={setResources}
      />
      {props.canWrite ? (
        <Button
          id="save-roles"
          onClick={() =>
            props.onSave({
              configuration: writeConfiguration({
                ...props.configuration,
                contactRoleKeys: roles,
                relationKeys: relations,
                resourceTypes: resources,
              }),
            })
          }
        >
          {t("platform.industry.action.save")}
        </Button>
      ) : null}
    </IndustrySection>
  );
}

function ResourceRow(props: {
  resource: IndustryTemplateResourceType;
  canWrite: boolean;
  canRemove: boolean;
  memberLabel: string;
  removeLabel: string;
  onMember: (isMember: boolean) => void;
  onRemove: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{props.resource.resourceTypeKey}</span>
      <span>{props.resource.termKey}</span>
      <Checkbox
        label={props.memberLabel}
        checked={props.resource.isMember}
        disabled={!props.canWrite}
        onChange={(event) => props.onMember(event.target.checked)}
      />
      {props.canRemove ? (
        <Button variant="secondary" onClick={props.onRemove}>
          {props.removeLabel}
        </Button>
      ) : null}
    </div>
  );
}

function ResourceRows(props: {
  resources: readonly IndustryTemplateResourceType[];
  canWrite: boolean;
  refusesRemoval: boolean;
  originalKeys: ReadonlySet<string>;
  memberLabel: string;
  removeLabel: string;
  onResources: (resources: IndustryTemplateResourceType[]) => void;
}): ReactElement {
  return (
    <>
      {props.resources.map((resource) => (
        <ResourceRow
          key={resource.resourceTypeKey}
          resource={resource}
          canWrite={props.canWrite}
          canRemove={
            props.canWrite &&
            !(props.refusesRemoval && props.originalKeys.has(resource.resourceTypeKey))
          }
          memberLabel={props.memberLabel}
          removeLabel={props.removeLabel}
          onMember={(isMember) =>
            props.onResources(
              props.resources.map((item) =>
                item.resourceTypeKey === resource.resourceTypeKey ? { ...item, isMember } : item,
              ),
            )
          }
          onRemove={() =>
            props.onResources(
              props.resources.filter((item) => item.resourceTypeKey !== resource.resourceTypeKey),
            )
          }
        />
      ))}
    </>
  );
}

function ResourceEditor(props: {
  resources: readonly IndustryTemplateResourceType[];
  canWrite: boolean;
  refusesRemoval: boolean;
  originalKeys: ReadonlySet<string>;
  labels: IndustryLabels;
  onResources: (resources: IndustryTemplateResourceType[]) => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const [resourceKey, setResourceKey] = useState("");
  const [termKey, setTermKey] = useState("");

  function addResource(): void {
    const key = resourceKey.trim();
    if (key.length === 0) return;
    props.onResources([
      ...props.resources,
      { resourceTypeKey: key, termKey: termKey.trim(), isMember: false },
    ]);
    setResourceKey("");
    setTermKey("");
  }

  return (
    <>
      <ResourceRows
        resources={props.resources}
        canWrite={props.canWrite}
        refusesRemoval={props.refusesRemoval}
        originalKeys={props.originalKeys}
        memberLabel={t("platform.industry.field.isMember")}
        removeLabel={t("platform.industry.action.remove")}
        onResources={props.onResources}
      />
      {props.canWrite ? (
        <ResourceDraft
          resourceKey={resourceKey}
          termKey={termKey}
          keyLabel={t("platform.industry.field.resourceTypeKey")}
          termLabel={t("platform.industry.field.resourceTerm")}
          addLabel={t("platform.industry.action.addResource")}
          onKey={setResourceKey}
          onTerm={setTermKey}
          onAdd={addResource}
        />
      ) : null}
    </>
  );
}

function ResourceDraft(props: {
  resourceKey: string;
  termKey: string;
  keyLabel: string;
  termLabel: string;
  addLabel: string;
  onKey: (value: string) => void;
  onTerm: (value: string) => void;
  onAdd: () => void;
}): ReactElement {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <FormField label={props.keyLabel} htmlFor="resource-key">
        <TextInput
          id="resource-key"
          value={props.resourceKey}
          onChange={(event) => props.onKey(event.target.value)}
        />
      </FormField>
      <FormField label={props.termLabel} htmlFor="resource-term">
        <TextInput
          id="resource-term"
          value={props.termKey}
          onChange={(event) => props.onTerm(event.target.value)}
        />
      </FormField>
      <Button id="add-resource" variant="secondary" onClick={props.onAdd}>
        {props.addLabel}
      </Button>
    </div>
  );
}

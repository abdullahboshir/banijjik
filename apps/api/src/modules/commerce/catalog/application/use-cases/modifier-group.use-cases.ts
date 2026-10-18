import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  type AuditAction,
  type AuditChanges,
} from "@banijjik/contracts";
import {
  type CatalogRecordStatus,
  type ModifierGroupResponse,
  type ModifierSelection,
} from "@banijjik/contracts/catalog";
import type { ModifierGroupId, OrganizationId, UserId } from "@banijjik/ids";
import type { ModifierOptionInput } from "@banijjik/validation";
import { diffAuditFields, type AuditFields } from "../../../../../kernel/audit/index.js";
import { recordNotFound } from "../../domain/errors.js";
import {
  ModifierGroup,
  mergeOptions,
  type ModifierOption,
} from "../../domain/modifier-group.entity.js";
import type { CatalogDependencies } from "../catalog-dependencies.js";
import type { Page } from "../ports/offering-repository.js";

interface Actor {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

export interface CreateModifierGroupInput extends Actor {
  readonly name: string;
  readonly selection: ModifierSelection;
  readonly isRequired: boolean;
  readonly minSelect: number;
  readonly maxSelect: number;
  readonly options: readonly ModifierOptionInput[];
}

export interface UpdateModifierGroupInput extends Actor {
  readonly modifierGroupId: ModifierGroupId;
  readonly version: number;
  readonly name?: string | undefined;
  readonly selection?: ModifierSelection | undefined;
  readonly isRequired?: boolean | undefined;
  readonly minSelect?: number | undefined;
  readonly maxSelect?: number | undefined;
  /** The full option list: a known id keeps its option, no id is new, a missing one is archived. */
  readonly options?: readonly ModifierOptionInput[] | undefined;
}

export function toModifierGroupResponse(group: ModifierGroup): ModifierGroupResponse {
  return {
    modifierGroupId: group.modifierGroupId,
    name: group.name,
    selection: group.selection,
    isRequired: group.isRequired,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    options: group.options,
    status: group.status,
    version: group.version,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

function groupFields(group: ModifierGroup | undefined): AuditFields {
  if (group === undefined) return {};
  const fields: Record<string, string | number | boolean> = {
    name: group.name,
    selection: group.selection,
    isRequired: group.isRequired,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    status: group.status,
  };
  for (const option of group.options) {
    fields[`options.${option.modifierOptionId}.name`] = option.name;
    fields[`options.${option.modifierOptionId}.priceDelta`] = option.priceDelta.amount;
    fields[`options.${option.modifierOptionId}.status`] = option.status;
  }
  return fields;
}

function record(
  dependencies: Pick<CatalogDependencies, "audit">,
  entry: { action: AuditAction; before: ModifierGroup | undefined; after: ModifierGroup },
): Promise<void> {
  const changes: AuditChanges = diffAuditFields(
    groupFields(entry.before),
    groupFields(entry.after),
  );
  return dependencies.audit.record({
    action: entry.action,
    entityType: AUDIT_ENTITY_TYPE.modifierGroup,
    entityId: entry.after.modifierGroupId,
    changes,
  });
}

/** Adds an add-on group (ADR-072). Option prices must be in the organization's currency. */
export class CreateModifierGroupUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: CreateModifierGroupInput): Promise<ModifierGroupResponse> {
    const { organization, modifierGroups, unitOfWork, clock } = this.dependencies;
    const { currency } = await organization.read(input.organizationId);
    const options = mergeOptions({ existing: [], drafts: input.options, currency });
    const saved = await unitOfWork.run(async () => {
      const group = ModifierGroup.create({
        modifierGroupId: ModifierGroup.newId(),
        organizationId: input.organizationId,
        name: input.name,
        selection: input.selection,
        isRequired: input.isRequired,
        minSelect: input.minSelect,
        maxSelect: input.maxSelect,
        options,
        createdByUserId: input.actorUserId,
        now: clock.now(),
      });
      await modifierGroups.insert(group);
      await record(this.dependencies, {
        action: AUDIT_ACTION.MODIFIER_GROUP_CREATED,
        before: undefined,
        after: group,
      });
      return group;
    });
    return toModifierGroupResponse(saved);
  }
}

/** Edits an add-on group; an option left out of the list is archived, never deleted. */
export class UpdateModifierGroupUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: UpdateModifierGroupInput): Promise<ModifierGroupResponse> {
    const { organization, modifierGroups, unitOfWork } = this.dependencies;
    const { currency } = await organization.read(input.organizationId);
    const saved = await unitOfWork.run(async () => {
      const existing = await modifierGroups.findById(input.modifierGroupId);
      if (existing === undefined) throw recordNotFound();
      const options: ModifierOption[] | undefined =
        input.options === undefined
          ? undefined
          : mergeOptions({ existing: existing.options, drafts: input.options, currency });
      const edited = existing.withChanges({
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.selection === undefined ? {} : { selection: input.selection }),
        ...(input.isRequired === undefined ? {} : { isRequired: input.isRequired }),
        ...(input.minSelect === undefined ? {} : { minSelect: input.minSelect }),
        ...(input.maxSelect === undefined ? {} : { maxSelect: input.maxSelect }),
        ...(options === undefined ? {} : { options }),
      });
      const updated = await modifierGroups.update(edited, input.version, input.actorUserId);
      await record(this.dependencies, {
        action: AUDIT_ACTION.MODIFIER_GROUP_UPDATED,
        before: existing,
        after: updated,
      });
      return updated;
    });
    return toModifierGroupResponse(saved);
  }
}

/** Archives an add-on group. Offerings that still name it keep the reference but the group is no longer offered. */
export class ArchiveModifierGroupUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(
    input: Actor & { readonly modifierGroupId: ModifierGroupId; readonly version: number },
  ): Promise<ModifierGroupResponse> {
    const { modifierGroups, unitOfWork } = this.dependencies;
    const saved = await unitOfWork.run(async () => {
      const existing = await modifierGroups.findById(input.modifierGroupId);
      if (existing === undefined) throw recordNotFound();
      const archived = existing.archive();
      const updated = await modifierGroups.update(archived, input.version, input.actorUserId);
      await record(this.dependencies, {
        action: AUDIT_ACTION.MODIFIER_GROUP_ARCHIVED,
        before: existing,
        after: updated,
      });
      return updated;
    });
    return toModifierGroupResponse(saved);
  }
}

/** One add-on group. */
export class GetModifierGroupUseCase {
  constructor(private readonly modifierGroups: CatalogDependencies["modifierGroups"]) {}

  async execute(input: {
    readonly modifierGroupId: ModifierGroupId;
  }): Promise<ModifierGroupResponse> {
    const group = await this.modifierGroups.findById(input.modifierGroupId);
    if (group === undefined) throw recordNotFound();
    return toModifierGroupResponse(group);
  }
}

/** A page of add-on groups, newest change first. */
export class ListModifierGroupsUseCase {
  constructor(private readonly modifierGroups: CatalogDependencies["modifierGroups"]) {}

  async execute(input: {
    readonly status: CatalogRecordStatus;
    readonly page: number;
    readonly limit: number;
  }): Promise<Page<ModifierGroupResponse>> {
    const page = await this.modifierGroups.list(input);
    return { items: page.items.map(toModifierGroupResponse), hasNext: page.hasNext };
  }
}

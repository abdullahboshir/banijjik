import {
  CATALOG_RECORD_STATUS,
  MODIFIER_SELECTION,
  type CatalogRecordStatus,
  type ModifierSelection,
  type Money,
} from "@banijjik/contracts/catalog";
import { newId, type ModifierGroupId, type OrganizationId, type UserId } from "@banijjik/ids";
import { invalidField, invalidFields, invalidTransition, type FieldProblem } from "./errors.js";

const SELECTION_INVALID_KEY = "errors.modifier_group_selection_invalid";
const CURRENCY_KEY = "errors.offering_currency_mismatch";
const UNKNOWN_OPTION_KEY = "errors.offering_variant_unknown";

export interface ModifierOption {
  readonly modifierOptionId: string;
  readonly name: string;
  readonly priceDelta: Money;
  readonly status: CatalogRecordStatus;
}

/** An option as sent: a known id keeps it, a missing id is issued by the server. */
export interface ModifierOptionDraft {
  readonly modifierOptionId?: string | undefined;
  readonly name: string;
  readonly priceDelta: Money;
  readonly status: CatalogRecordStatus;
}

export interface ModifierGroupProps {
  readonly modifierGroupId: ModifierGroupId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly selection: ModifierSelection;
  readonly isRequired: boolean;
  readonly minSelect: number;
  readonly maxSelect: number;
  readonly options: readonly ModifierOption[];
  readonly status: CatalogRecordStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
}

export interface NewModifierGroupInput {
  readonly modifierGroupId: ModifierGroupId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly selection: ModifierSelection;
  readonly isRequired: boolean;
  readonly minSelect: number;
  readonly maxSelect: number;
  readonly options: readonly ModifierOption[];
  readonly createdByUserId: UserId;
  readonly now: Date;
}

export interface ModifierGroupChanges {
  readonly name?: string;
  readonly selection?: ModifierSelection;
  readonly isRequired?: boolean;
  readonly minSelect?: number;
  readonly maxSelect?: number;
  readonly options?: readonly ModifierOption[];
}

const INITIAL_VERSION = 1;

/**
 * The option list after an edit, from the full list the request sent: a known id keeps its option,
 * a missing id is a new option, an existing option left out is archived (never deleted, because an
 * order line may already name it). Options must be in the organization's currency.
 */
export function mergeOptions(input: {
  readonly existing: readonly ModifierOption[];
  readonly drafts: readonly ModifierOptionDraft[];
  readonly currency: string;
}): ModifierOption[] {
  const { existing, drafts, currency } = input;
  const known = new Set(existing.map((option) => option.modifierOptionId));
  const problems: FieldProblem[] = [];
  const kept = drafts.map((draft, index) => {
    if (draft.modifierOptionId !== undefined && !known.has(draft.modifierOptionId)) {
      problems.push({ path: `options.${index}.modifierOptionId`, messageKey: UNKNOWN_OPTION_KEY });
    }
    if (draft.priceDelta.currency !== currency) {
      problems.push({ path: `options.${index}.priceDelta.currency`, messageKey: CURRENCY_KEY });
    }
    return {
      modifierOptionId: draft.modifierOptionId ?? newId(),
      name: draft.name,
      priceDelta: draft.priceDelta,
      status: draft.status,
    };
  });
  if (problems.length > 0) throw invalidFields(problems);
  const keptIds = new Set(kept.map((option) => option.modifierOptionId));
  const archived = existing
    .filter((option) => !keptIds.has(option.modifierOptionId))
    .map((option) => ({ ...option, status: CATALOG_RECORD_STATUS.ARCHIVED }));
  return [...kept, ...archived];
}

/** Whether `selection`, `isRequired`, `minSelect`, `maxSelect` and the ACTIVE option count agree. */
export function assertSelectionRules(group: {
  readonly selection: ModifierSelection;
  readonly isRequired: boolean;
  readonly minSelect: number;
  readonly maxSelect: number;
  readonly options: readonly ModifierOption[];
}): void {
  const activeOptions = group.options.filter(
    (option) => option.status === CATALOG_RECORD_STATUS.ACTIVE,
  ).length;
  const isConsistent =
    activeOptions >= 1 &&
    group.minSelect <= group.maxSelect &&
    group.maxSelect <= activeOptions &&
    group.isRequired === group.minSelect >= 1 &&
    (group.selection === MODIFIER_SELECTION.MULTIPLE || group.maxSelect === 1);
  if (!isConsistent) throw invalidField("selection", SELECTION_INVALID_KEY);
}

/** An add-on group (ADR-072): extra choices on an offering, each with a price change and no stock of its own. */
export class ModifierGroup implements ModifierGroupProps {
  readonly modifierGroupId: ModifierGroupId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly selection: ModifierSelection;
  readonly isRequired: boolean;
  readonly minSelect: number;
  readonly maxSelect: number;
  readonly options: readonly ModifierOption[];
  readonly status: CatalogRecordStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;

  private constructor(props: ModifierGroupProps) {
    this.modifierGroupId = props.modifierGroupId;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.selection = props.selection;
    this.isRequired = props.isRequired;
    this.minSelect = props.minSelect;
    this.maxSelect = props.maxSelect;
    this.options = props.options;
    this.status = props.status;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  static newId(): ModifierGroupId {
    return newId<ModifierGroupId>();
  }

  static create(input: NewModifierGroupInput): ModifierGroup {
    assertSelectionRules(input);
    return new ModifierGroup({
      ...input,
      status: CATALOG_RECORD_STATUS.ACTIVE,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: ModifierGroupProps): ModifierGroup {
    return new ModifierGroup(props);
  }

  withChanges(changes: ModifierGroupChanges): ModifierGroup {
    if (this.status === CATALOG_RECORD_STATUS.ARCHIVED) throw invalidTransition(this.status);
    const edited = new ModifierGroup({
      ...this,
      name: changes.name ?? this.name,
      selection: changes.selection ?? this.selection,
      isRequired: changes.isRequired ?? this.isRequired,
      minSelect: changes.minSelect ?? this.minSelect,
      maxSelect: changes.maxSelect ?? this.maxSelect,
      options: changes.options ?? this.options,
    });
    assertSelectionRules(edited);
    return edited;
  }

  archive(): ModifierGroup {
    if (this.status === CATALOG_RECORD_STATUS.ARCHIVED) throw invalidTransition(this.status);
    return new ModifierGroup({ ...this, status: CATALOG_RECORD_STATUS.ARCHIVED });
  }
}

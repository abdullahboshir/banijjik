import {
  MODIFIER_SELECTION,
  type Money,
  type ModifierGroupResponse,
  type ModifierSelection,
} from "@banijjik/contracts/catalog";
import { moneyFromInput, moneyToInputText } from "@banijjik/web-client";
import { normalizeRules, type AddOnRules } from "./add-on-rules";
import type { ModifierGroupWrite } from "./record-api";

export interface OptionDraft {
  modifierOptionId?: string | undefined;
  name: string;
  priceText: string;
}

/** The add-on form as typed: numbers stay text until the body is built. */
export interface GroupDraft {
  selection: ModifierSelection;
  isRequired: boolean;
  maxSelect: string;
  minSelect: string;
  name: string;
  options: OptionDraft[];
}

export const EMPTY_OPTION: OptionDraft = { name: "", priceText: "" };

export function draftOf(group: ModifierGroupResponse | undefined): GroupDraft {
  if (!group) {
    return {
      name: "",
      selection: MODIFIER_SELECTION.MULTIPLE,
      isRequired: false,
      minSelect: "0",
      maxSelect: "1",
      options: [EMPTY_OPTION],
    };
  }
  return {
    name: group.name,
    selection: group.selection,
    isRequired: group.isRequired,
    minSelect: String(group.minSelect),
    maxSelect: String(group.maxSelect),
    options: group.options
      .filter((option) => option.status === "ACTIVE")
      .map((option) => ({
        modifierOptionId: option.modifierOptionId,
        name: option.name,
        priceText: option.priceDelta.amount === 0 ? "" : moneyToInputText(option.priceDelta),
      })),
  };
}

/** The four rule settings of the draft, made to agree with each other and with the option count. */
export function rulesOf(draft: GroupDraft): AddOnRules {
  return normalizeRules(
    {
      selection: draft.selection,
      isRequired: draft.isRequired,
      minSelect: Number(draft.minSelect) || 0,
      maxSelect: Number(draft.maxSelect) || 1,
    },
    draft.options.length,
  );
}

function optionsOf(
  draft: GroupDraft,
  currency: Money["currency"],
): ModifierGroupWrite["options"] | undefined {
  const named = draft.options.filter((option) => option.name.trim() !== "");
  const options = named.map((option) => ({
    ...(option.modifierOptionId ? { modifierOptionId: option.modifierOptionId } : {}),
    name: option.name.trim(),
    priceDelta: moneyFromInput(option.priceText.trim() || "0", currency),
  }));
  const readable: ModifierGroupWrite["options"] = [];
  for (const option of options) {
    if (option.priceDelta === undefined) return undefined;
    readable.push({ ...option, priceDelta: option.priceDelta });
  }
  return readable.length === 0 ? undefined : readable;
}

/** The body to send, or undefined when a name is missing or a price cannot be read. */
export function bodyOf(
  draft: GroupDraft,
  currency: Money["currency"],
): ModifierGroupWrite | undefined {
  const options = optionsOf(draft, currency);
  if (draft.name.trim() === "" || options === undefined) return undefined;
  return { name: draft.name.trim(), ...rulesOf({ ...draft, options: draft.options }), options };
}

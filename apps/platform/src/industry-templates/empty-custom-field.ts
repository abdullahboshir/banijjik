import { CUSTOM_FIELD_TYPE, type IndustryTemplateCustomField } from "@banijjik/contracts";

/** A blank field the editor fills in. Labels start empty so the API schema refuses a save until both are set. */
export function emptyCustomField(): IndustryTemplateCustomField {
  return {
    entityType: "contact",
    fieldKey: "",
    fieldType: CUSTOM_FIELD_TYPE.TEXT,
    isRequired: false,
    botAsk: false,
    visibility: { admin: true, storefront: false, bot: false },
    isSearchable: false,
    isSensitive: false,
    label: { bn: "", en: "" },
  };
}

import type { EffectiveCustomField } from "@banijjik/contracts";
import type { DirectoryConfigResponse } from "@banijjik/contracts/directory";
import type { Locale } from "@banijjik/i18n";
import { labelOf } from "../custom-fields/custom-field-display";

export interface SectionBlock {
  key: string;
  title: string;
  fields: EffectiveCustomField[];
}

/** Group listing fields by template section; leftovers go under `otherTitle`. */
export function sectionBlocksOf(input: {
  fields: readonly EffectiveCustomField[];
  sections: DirectoryConfigResponse["sections"];
  locale: Locale;
  otherTitle: string;
}): readonly SectionBlock[] {
  const bySection = new Map<string, EffectiveCustomField[]>();
  const unsectioned: EffectiveCustomField[] = [];
  for (const field of input.fields) {
    if (field.sectionKey === undefined) {
      unsectioned.push(field);
      continue;
    }
    const list = bySection.get(field.sectionKey) ?? [];
    list.push(field);
    bySection.set(field.sectionKey, list);
  }
  return [
    ...input.sections.map((section) => ({
      key: section.sectionKey,
      title: labelOf(section.label, input.locale),
      fields: bySection.get(section.sectionKey) ?? [],
    })),
    ...(unsectioned.length > 0
      ? [{ key: "_other", title: input.otherTitle, fields: unsectioned }]
      : []),
  ];
}

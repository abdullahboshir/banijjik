import { BRAND_COLOR_PRESETS } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";

/** The text of one colour box. The two hints say what the colour is used for. */
export interface ColourLabels {
  name: string;
  hint: string;
}

/**
 * Everything the branding form says, drawn on the server: the client catalog holds the API messages
 * only, so screen texts reach client components as plain labels (the pattern of the profile form).
 * A few are templates with `{name}`, `{ratio}`, `{count}` or `{max}`, filled by `fillTemplate`.
 */
export interface BrandingLabels {
  readOnly: string;
  logoTitle: string;
  logoHelp: string;
  logo: {
    choose: string;
    change: string;
    remove: string;
    uploading: string;
    alt: string;
  };
  coloursTitle: string;
  coloursHelp: string;
  presetsGroup: string;
  presetNames: Record<string, string>;
  custom: string;
  clearColour: string;
  primary: ColourLabels;
  accent: ColourLabels;
  /** Templates. */
  pickerFor: string;
  contrastOk: string;
  contrastLow: string;
  invalidColour: string;
  taglineTitle: string;
  taglineHelp: string;
  taglineLabel: string;
  taglineCounter: string;
  previewTitle: string;
  previewHelp: string;
  previewButton: string;
  previewLink: string;
  previewBadge: string;
  save: string;
  actions: string;
  saved: string;
  conflict: string;
  reload: string;
}

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function brandingLabelsOf(t: Translator["t"]): BrandingLabels {
  return {
    readOnly: t("branding.readOnly"),
    logoTitle: t("branding.section.logo"),
    logoHelp: t("branding.section.logo.help"),
    logo: {
      choose: t("branding.logo.choose"),
      change: t("branding.logo.change"),
      remove: t("branding.logo.remove"),
      uploading: t("branding.logo.uploading"),
      alt: t("branding.logo.alt"),
    },
    coloursTitle: t("branding.section.colours"),
    coloursHelp: t("branding.section.colours.help"),
    presetsGroup: t("branding.colours.presets"),
    presetNames: Object.fromEntries(
      BRAND_COLOR_PRESETS.map((preset) => [
        preset.presetKey,
        t(`branding.preset.${preset.presetKey}`),
      ]),
    ),
    custom: t("branding.colours.custom"),
    clearColour: t("branding.colours.clear"),
    primary: { name: t("branding.colours.primary"), hint: t("branding.colours.primary.hint") },
    accent: { name: t("branding.colours.accent"), hint: t("branding.colours.accent.hint") },
    pickerFor: t("branding.colours.picker"),
    contrastOk: t("branding.colours.contrast.ok"),
    contrastLow: t("branding.colours.contrast.low"),
    invalidColour: t("branding.colours.invalid"),
    taglineTitle: t("branding.section.tagline"),
    taglineHelp: t("branding.section.tagline.help"),
    taglineLabel: t("branding.tagline.label"),
    taglineCounter: t("branding.tagline.counter"),
    previewTitle: t("branding.preview.title"),
    previewHelp: t("branding.preview.help"),
    previewButton: t("branding.preview.button"),
    previewLink: t("branding.preview.link"),
    previewBadge: t("branding.preview.badge"),
    save: t("branding.save"),
    actions: t("branding.actions"),
    saved: t("branding.saved"),
    conflict: t("branding.conflict"),
    reload: t("branding.reload"),
  };
}

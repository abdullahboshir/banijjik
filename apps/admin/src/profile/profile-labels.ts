import type { PreferredLocale } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import type { ProfileFormState } from "./profile-state";

export interface ProfileFormLabels {
  title: string;
  close: string;
  submit: string;
  keepHint: string;
  conflict: string;
  reload: string;
  sections: { business: string; legal: string; address: string };
  fields: Record<Exclude<keyof ProfileFormState, "defaultLocale">, string> & {
    defaultLocale: string;
  };
  locales: Record<PreferredLocale, string>;
}

export function profileLabelsOf(t: Translator["t"]): ProfileFormLabels {
  return {
    title: t("profile.form.title"),
    close: t("shell.closeMenu"),
    submit: t("common.save"),
    keepHint: t("profile.keepHint"),
    conflict: t("settings.conflict"),
    reload: t("settings.reload"),
    sections: {
      business: t("profile.section.business"),
      legal: t("profile.section.legal"),
      address: t("profile.section.address"),
    },
    fields: {
      name: t("profile.field.name"),
      defaultLocale: t("profile.field.defaultLocale"),
      legalName: t("profile.field.legalName"),
      legalType: t("profile.field.legalType"),
      businessPhone: t("profile.field.phone"),
      businessEmail: t("profile.field.email"),
      line1: t("address.line1"),
      area: t("address.area"),
      thana: t("address.thana"),
      district: t("address.district"),
      postalCode: t("address.postalCode"),
      tradeLicenseNumber: t("profile.field.tradeLicenseNumber"),
    },
    locales: { bn: t("profile.locale.bn"), en: t("profile.locale.en") },
  };
}

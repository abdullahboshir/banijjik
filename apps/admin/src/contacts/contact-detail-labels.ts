import type { Translator } from "@banijjik/i18n";
import type { ContactActionLabels } from "./contact-action-dialogs";
import type { ContactAddressesLabels } from "./contact-addresses";

/** All text of the detail page's client parts, translated on the server. */
export interface ContactDetailLabels {
  actions: ContactActionLabels;
  addresses: ContactAddressesLabels;
}

export function contactActionLabelsOf(t: Translator["t"]): ContactActionLabels {
  const confirmWord = t("contacts.anonymize.confirmWord");
  return {
    close: t("shell.closeMenu"),
    cancel: t("common.cancel"),
    conflict: t("settings.conflict"),
    archive: {
      title: t("contacts.archive.title"),
      description: t("contacts.archive.description"),
      confirm: t("contacts.action.archive"),
    },
    anonymize: {
      title: t("contacts.anonymize.title"),
      description: t("contacts.anonymize.description"),
      reason: t("contacts.anonymize.reason"),
      typeToConfirm: t("contacts.anonymize.typeToConfirm", { word: confirmWord }),
      confirmWord,
      confirm: t("contacts.action.anonymize"),
    },
  };
}

export function addressLabelsOf(t: Translator["t"]): ContactAddressesLabels {
  return {
    title: t("contacts.addresses.title"),
    help: t("contacts.addresses.help"),
    empty: t("contacts.addresses.empty"),
    add: t("contacts.addresses.add"),
    edit: t("contacts.addresses.edit"),
    defaultMark: t("contacts.addresses.default"),
    makeDefault: t("contacts.addresses.makeDefault"),
    addTitle: t("contacts.addresses.add"),
    editTitle: t("contacts.addresses.edit"),
    close: t("shell.closeMenu"),
    save: t("common.save"),
    conflict: t("settings.conflict"),
    reload: t("settings.reload"),
    label: t("contacts.address.label"),
    line1: t("address.line1"),
    area: t("address.area"),
    thana: t("address.thana"),
    district: t("address.district"),
    postalCode: t("address.postalCode"),
    isDefault: t("contacts.address.isDefault"),
  };
}

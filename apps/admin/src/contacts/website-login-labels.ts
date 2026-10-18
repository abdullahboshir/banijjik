import type { Translator } from "@banijjik/i18n";

/** The text of the confirmation for one change of a website login. */
export interface WebsiteLoginConfirmLabels {
  title: string;
  description: string;
  confirm: string;
}

/** All text of the "Website login" section's client parts, translated on the server. */
export interface WebsiteLoginLabels {
  close: string;
  cancel: string;
  conflict: string;
  block: WebsiteLoginConfirmLabels;
  unblock: WebsiteLoginConfirmLabels;
}

export function websiteLoginLabelsOf(t: Translator["t"]): WebsiteLoginLabels {
  return {
    close: t("shell.closeMenu"),
    cancel: t("common.cancel"),
    conflict: t("settings.conflict"),
    block: {
      title: t("contacts.login.blockTitle"),
      description: t("contacts.login.blockDescription"),
      confirm: t("contacts.login.block"),
    },
    unblock: {
      title: t("contacts.login.unblockTitle"),
      description: t("contacts.login.unblockDescription"),
      confirm: t("contacts.login.unblock"),
    },
  };
}

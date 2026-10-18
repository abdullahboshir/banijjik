import { CONTACT_ROLE, CURRENCY_CODE, PERMISSION_KEY } from "@banijjik/contracts";
import type { ContactResponse } from "@banijjik/contracts/contact";
import type { Translator } from "@banijjik/i18n";
import { customFieldPartsOf } from "../custom-fields/custom-field-parts";
import type { LinkedContacts } from "../custom-fields/custom-field-display";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermissionEverywhere } from "../shell/permissions";
import type { ContactFormLabels, ContactFormSheetProps } from "./contact-form-sheet";
import { contactTermOf, roleOptionsOf, type ContactWords } from "./contact-labels";

export function contactWordsOf(access: OrgAccess, translator: Translator): ContactWords {
  return { terms: access.config.terms, locale: translator.locale, t: translator.t };
}

/** Sensitive contact details are shown only to someone holding `readSensitive` at every location (ADR-107). */
export function canSeeSensitiveContactDetails(access: OrgAccess): boolean {
  return holdsPermissionEverywhere(
    access.config.permissions,
    PERMISSION_KEY.CONTACT_CONTACT_READ_SENSITIVE,
  );
}

export function contactFormLabelsOf(words: ContactWords): ContactFormLabels {
  const { t } = words;
  const term = contactTermOf(words);
  return {
    createTitle: t("contacts.form.create.title", { term }),
    editTitle: t("contacts.form.edit.title", { term }),
    close: t("shell.closeMenu"),
    save: t("common.save"),
    conflict: t("settings.conflict"),
    reload: t("settings.reload"),
    name: t("contacts.form.name"),
    phone: t("contacts.form.phone"),
    phoneHint: t("contacts.form.phone.hint"),
    email: t("contacts.form.email"),
    roles: t("contacts.form.roles"),
    duplicate: t("contacts.form.duplicate", { term }),
    openExisting: t("contacts.form.duplicate.open"),
  };
}

/** The role a new contact starts with: the customer role when the template has it, else its first role. */
function defaultRolesOf(roleKeys: OrgAccess["config"]["contactRoleKeys"]): ContactRoleList {
  const first = roleKeys.includes(CONTACT_ROLE.CUSTOMER) ? CONTACT_ROLE.CUSTOMER : roleKeys[0];
  return first === undefined ? [] : [first];
}

type ContactRoleList = ContactFormSheetProps["defaultRoles"];

/**
 * What the add and edit sheets need, built on the server: the roles the template allows with their names,
 * all contact fields of the business (the sheet picks the ones for the chosen roles) and, when editing,
 * the contact's current values.
 */
export function contactFormSheetPropsOf(input: {
  access: OrgAccess;
  translator: Translator;
  contact?: ContactResponse;
  linkedContacts?: LinkedContacts;
}): Omit<ContactFormSheetProps, "onClose"> {
  const { access, translator, contact } = input;
  const words = contactWordsOf(access, translator);
  const parts = customFieldPartsOf({
    fields: access.config.fields["contact"] ?? [],
    values: contact?.customFields ?? {},
    canSeeSensitive: canSeeSensitiveContactDetails(access),
    translator,
    timeZone: access.timeZone,
    currencyCode: CURRENCY_CODE.BDT,
    ...(input.linkedContacts === undefined ? {} : { linkedContacts: input.linkedContacts }),
  });
  return {
    organizationId: access.organization.organizationId,
    ...(contact === undefined
      ? {}
      : {
          contact: {
            contactId: contact.contactId,
            version: contact.version,
            name: contact.name ?? "",
            phone: contact.phoneE164 ?? "",
            email: contact.email ?? "",
            roles: contact.contactRoles,
          },
        }),
    roleOptions: roleOptionsOf(access.config.contactRoleKeys, words),
    defaultRoles: defaultRolesOf(access.config.contactRoleKeys),
    customFields: parts.form,
    listPath: `/${access.organization.slug}/contacts`,
    labels: contactFormLabelsOf(words),
  };
}

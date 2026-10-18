import { CONTACT_ROLE, type ContactRole } from "@banijjik/contracts";
import type { Locale, Translator } from "@banijjik/i18n";
import { termLabel, type TermTexts } from "@banijjik/web-client";

/** The terms and language that name the contacts and their roles. */
export interface ContactWords {
  terms: TermTexts;
  locale: Locale;
  t: Translator["t"];
}

/**
 * The word for a contact: the business's term `contact` in the user's language ("ছাত্র-ছাত্রী", "Member"),
 * or the catalog word. Every title, button and empty state reads it (ADR-104).
 */
export function contactTermOf(words: ContactWords): string {
  return termLabel(words.terms, "contact", {
    locale: words.locale,
    fallback: words.t("contacts.term"),
  });
}

/**
 * The name of a role (ADR-113): the term `contact.<ROLE>` when the template or the business has one,
 * else, for a customer, the business's word for a contact, else the catalog name `contactRole.<ROLE>`.
 */
export function roleLabelOf(role: ContactRole, words: ContactWords): string {
  const { terms, locale, t } = words;
  const fallback = role === CONTACT_ROLE.CUSTOMER ? contactTermOf(words) : t(`contactRole.${role}`);
  return termLabel(terms, `contact.${role}`, { locale, fallback });
}

export interface RoleOption {
  role: ContactRole;
  label: string;
}

/** The roles the template allows (`/me/config` `contactRoleKeys`), each with its name. */
export function roleOptionsOf(roleKeys: readonly ContactRole[], words: ContactWords): RoleOption[] {
  return roleKeys.map((role) => ({ role, label: roleLabelOf(role, words) }));
}

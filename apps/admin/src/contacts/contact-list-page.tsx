import { PERMISSION_KEY, type ContactRole } from "@banijjik/contracts";
import type { ContactListItem } from "@banijjik/contracts/contact";
import type { Translator } from "@banijjik/i18n";
import { Button, buttonVariants, EmptyState, PageLayout, TextInput } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ContactFormButton } from "./contact-form-button";
import { contactFormSheetPropsOf, contactWordsOf } from "./contact-form-props";
import { contactTermOf, roleLabelOf, roleOptionsOf, type ContactWords } from "./contact-labels";
import { ContactList, type ContactRowView } from "./contact-list";
import {
  contactListHref,
  contactsApiPath,
  parseContactQuery,
  type ContactQuery,
} from "./contact-query";

const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";

function toRows(items: ContactListItem[], words: ContactWords): ContactRowView[] {
  const { t } = words;
  return items.map((item) => ({
    contactId: item.contactId,
    name: item.name ?? t("contacts.noName"),
    phone: item.phoneE164 ?? "",
    roles: item.contactRoles.map((role) => roleLabelOf(role, words)).join(", "),
    status: item.status,
    statusLabel: t(`contacts.status.${item.status}`),
  }));
}

function Chip(props: { href: string; isActive: boolean; label: string }): ReactElement {
  const tone = props.isActive
    ? "border-brand bg-brand text-on-brand"
    : "border-default bg-subtle text-primary";
  return (
    <Link
      href={props.href}
      aria-current={props.isActive ? "true" : undefined}
      className={`${CHIP_CLASS} ${tone}`}
    >
      {props.label}
    </Link>
  );
}

function FilterChips(props: {
  basePath: string;
  query: ContactQuery;
  words: ContactWords;
  roles: readonly ContactRole[];
}): ReactElement {
  const { basePath, query, words } = props;
  const options = roleOptionsOf(props.roles, words);
  const reset = { ...query, page: 1 };
  return (
    <nav
      aria-label={words.t("contacts.filter.label")}
      className="flex items-center gap-2 overflow-x-auto"
    >
      <Chip
        href={contactListHref(basePath, { ...reset, role: undefined })}
        isActive={query.role === undefined}
        label={words.t("contacts.filter.all")}
      />
      {options.map((option) => (
        <Chip
          key={option.role}
          href={contactListHref(basePath, { ...reset, role: option.role })}
          isActive={query.role === option.role}
          label={option.label}
        />
      ))}
      <Chip
        href={contactListHref(basePath, {
          ...reset,
          status: query.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED",
        })}
        isActive={query.status === "ARCHIVED"}
        label={words.t("contacts.filter.archived")}
      />
    </nav>
  );
}

function SearchForm({ query, t }: { query: ContactQuery; t: Translator["t"] }): ReactElement {
  return (
    <form method="get" role="search" className="flex gap-2">
      {query.role ? <input type="hidden" name="role" value={query.role} /> : null}
      {query.status === "ARCHIVED" ? <input type="hidden" name="status" value="ARCHIVED" /> : null}
      <TextInput
        name="q"
        type="search"
        defaultValue={query.q ?? ""}
        aria-label={t("contacts.search.label")}
      />
      <Button type="submit" variant="secondary">
        {t("contacts.search.submit")}
      </Button>
    </form>
  );
}

function Pager(props: {
  basePath: string;
  query: ContactQuery;
  hasNext: boolean;
  t: Translator["t"];
}): ReactElement | null {
  const { basePath, query, hasNext, t } = props;
  if (query.page === 1 && !hasNext) return null;
  const linkClass = buttonVariants({ variant: "secondary" });
  return (
    <nav className="mt-4 flex items-center justify-between gap-3">
      {query.page > 1 ? (
        <Link
          href={contactListHref(basePath, { ...query, page: query.page - 1 })}
          className={linkClass}
        >
          {t("contacts.page.previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">
        {t("contacts.page.current", { page: query.page })}
      </span>
      {hasNext ? (
        <Link
          href={contactListHref(basePath, { ...query, page: query.page + 1 })}
          className={linkClass}
        >
          {t("contacts.page.next")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function canCreate(access: OrgAccess): boolean {
  return (
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.CONTACT_CONTACT_CREATE)
  );
}

/** `/{orgSlug}/contacts`: the people the business works with, under its own word for them (13-UX section 4.1). */
export async function ContactListPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.CONTACT_CONTACT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const words = contactWordsOf(access, translator);
  const term = contactTermOf(words);
  const query = parseContactQuery(searchParams);
  const result = await fetchBusinessResource<ContactListItem[], PageMeta>(
    contactsApiPath(access.organization.organizationId, query),
  );
  const basePath = `/${orgSlug}/contacts`;
  return (
    <PageLayout
      title={term}
      subtitle={t("contacts.subtitle", { term })}
      actions={
        canCreate(access) ? (
          <ContactFormButton
            label={t("contacts.add", { term })}
            sheetProps={contactFormSheetPropsOf({ access, translator })}
          />
        ) : null
      }
      filters={
        <>
          <FilterChips
            basePath={basePath}
            query={query}
            words={words}
            roles={access.config.contactRoleKeys}
          />
          <SearchForm query={query} t={t} />
        </>
      }
    >
      <ContactList
        rows={toRows(result.data, words)}
        detailBasePath={basePath}
        labels={{
          name: t("contacts.column.name"),
          phone: t("contacts.column.phone"),
          roles: t("contacts.column.roles"),
          status: t("contacts.column.status"),
          empty: t("contacts.empty", { term }),
        }}
      />
      <Pager basePath={basePath} query={query} hasNext={result.meta?.hasNext ?? false} t={t} />
    </PageLayout>
  );
}

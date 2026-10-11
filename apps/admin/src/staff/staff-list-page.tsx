import {
  MEMBER_STATUS,
  PERMISSION_KEY,
  type MemberResponse,
  type MemberStatus,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { Button, buttonVariants, EmptyState, PageHeader, TextInput } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { holdsPermission } from "../shell/permissions";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { locationNamesOfMember, memberStatusLabel, roleNamesOfMember } from "./member-view";
import { StaffList, type StaffRowView } from "./staff-list";
import { loadStaffLookups, type StaffLookups } from "./staff-lookups";
import { membersApiPath, parseStaffQuery, staffListHref, type StaffQuery } from "./staff-query";

const FILTER_STATUSES: readonly MemberStatus[] = [
  MEMBER_STATUS.ACTIVE,
  MEMBER_STATUS.SUSPENDED,
  MEMBER_STATUS.REMOVED,
];
const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";

function toRows(
  members: MemberResponse[],
  lookups: StaffLookups,
  t: Translator["t"],
): StaffRowView[] {
  return members.map((member) => ({
    memberId: member.memberId,
    name: member.displayName,
    roles: roleNamesOfMember(member, lookups, t),
    locations: locationNamesOfMember(member, lookups, t),
    status: member.status,
    statusLabel: memberStatusLabel(member.status, t),
  }));
}

function StatusChips({
  basePath,
  query,
  t,
}: {
  basePath: string;
  query: StaffQuery;
  t: Translator["t"];
}): ReactElement {
  const chips = [
    { status: undefined, label: t("staff.filter.all") },
    ...FILTER_STATUSES.map((status) => ({ status, label: memberStatusLabel(status, t) })),
  ];
  return (
    <nav aria-label={t("staff.filter.label")} className="flex items-center gap-2 overflow-x-auto">
      {chips.map((chip) => {
        const isActive = chip.status === query.status;
        return (
          <Link
            key={chip.status ?? "all"}
            href={staffListHref(basePath, { ...query, status: chip.status, page: 1 })}
            aria-current={isActive ? "true" : undefined}
            className={`${CHIP_CLASS} ${isActive ? "border-brand bg-brand text-on-brand" : "border-default bg-subtle text-primary"}`}
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SearchForm({ query, t }: { query: StaffQuery; t: Translator["t"] }): ReactElement {
  return (
    <form method="get" role="search" className="flex gap-2">
      {query.status ? <input type="hidden" name="status" value={query.status} /> : null}
      <TextInput
        name="q"
        type="search"
        defaultValue={query.q ?? ""}
        aria-label={t("staff.search.label")}
      />
      <Button type="submit" variant="secondary">
        {t("staff.search.submit")}
      </Button>
    </form>
  );
}

function Pager({
  basePath,
  query,
  hasNext,
  t,
}: {
  basePath: string;
  query: StaffQuery;
  hasNext: boolean;
  t: Translator["t"];
}): ReactElement | null {
  if (query.page === 1 && !hasNext) return null;
  const linkClass = buttonVariants({ variant: "secondary" });
  return (
    <nav className="mt-4 flex items-center justify-between gap-3">
      {query.page > 1 ? (
        <Link
          href={staffListHref(basePath, { ...query, page: query.page - 1 })}
          className={linkClass}
        >
          {t("staff.page.previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">
        {t("staff.page.current", { page: query.page })}
      </span>
      {hasNext ? (
        <Link
          href={staffListHref(basePath, { ...query, page: query.page + 1 })}
          className={linkClass}
        >
          {t("staff.page.next")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function StaffHeaderActions({
  access,
  orgSlug,
  t,
}: {
  access: OrgAccess;
  orgSlug: string;
  t: Translator["t"];
}): ReactElement {
  const { permissions } = access.config;
  const basePath = `/${orgSlug}/settings/staff`;
  return (
    <>
      {holdsPermission(permissions, PERMISSION_KEY.IAM_ROLE_READ) ? (
        <Link
          href={`/${orgSlug}/settings/roles`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("roles.link")}
        </Link>
      ) : null}
      {holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE) ? (
        <Link href={`${basePath}/invitations`} className={buttonVariants({ variant: "primary" })}>
          {access.canWrite ? t("staff.invite") : t("staff.invitations")}
        </Link>
      ) : null}
    </>
  );
}

/** `/{orgSlug}/settings/staff`: the team of the business (13-UX section 4.1). */
export async function StaffListPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [{ t }, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_MEMBER_READ)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const query = parseStaffQuery(searchParams);
  const { organizationId } = access.organization;
  const [members, lookups] = await Promise.all([
    fetchBusinessResource<MemberResponse[], PageMeta>(membersApiPath(organizationId, query)),
    loadStaffLookups(access, t),
  ]);
  const basePath = `/${orgSlug}/settings/staff`;
  return (
    <>
      <PageHeader
        title={t("menu.organization.staff")}
        actions={<StaffHeaderActions access={access} orgSlug={orgSlug} t={t} />}
        filters={
          <>
            <StatusChips basePath={basePath} query={query} t={t} />
            <SearchForm query={query} t={t} />
          </>
        }
      />
      <StaffList
        rows={toRows(members.data, lookups, t)}
        detailBasePath={basePath}
        showLocations={lookups.isMultiLocation}
        labels={{
          name: t("staff.column.name"),
          roles: t("staff.column.roles"),
          locations: t("staff.column.locations"),
          status: t("staff.column.status"),
          empty: t("staff.empty"),
        }}
      />
      <Pager basePath={basePath} query={query} hasNext={members.meta?.hasNext ?? false} t={t} />
    </>
  );
}

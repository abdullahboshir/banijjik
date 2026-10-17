import { PERMISSION_KEY, type RoleSummary } from "@banijjik/contracts";
import { EmptyState, PageLayout, buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission, holdsPermissionEverywhere } from "../shell/permissions";
import { NewRoleButton } from "./new-role-button";
import { RoleList } from "./role-list";
import { roleFormGroupsOf, roleFormLabelsOf } from "./role-labels";
import { roleGroupsOf, toRoleRows } from "./role-view";

const PAGE_SIZE = 100;

/** `/{orgSlug}/settings/roles`: the system roles and the custom ones, with how many members hold each. */
export async function RolesPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions, permissionDefinitions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.IAM_ROLE_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const roles = await fetchBusinessResource<RoleSummary[]>(
    `/orgs/${organizationId}/roles?limit=${PAGE_SIZE}`,
  );
  const canCreate =
    access.canWrite && holdsPermissionEverywhere(permissions, PERMISSION_KEY.IAM_ROLE_CREATE);
  const groups = roleGroupsOf({
    definitions: permissionDefinitions,
    permissions,
    role: undefined,
    mode: "offer",
    translator,
  });
  return (
    <>
      <Link
        href={`/${orgSlug}/settings/staff`}
        className={`${buttonVariants({ variant: "secondary" })} mb-3`}
      >
        {t("staff.detail.back")}
      </Link>
      <PageLayout
        title={t("roles.title")}
        subtitle={t("roles.subtitle")}
        actions={
          canCreate ? (
            <NewRoleButton
              organizationId={organizationId}
              label={t("roles.add")}
              groups={roleFormGroupsOf(groups, t)}
              labels={roleFormLabelsOf(t)}
            />
          ) : null
        }
      >
        <RoleList
          rows={toRoleRows(roles.data, t)}
          detailBasePath={`/${orgSlug}/settings/roles`}
          labels={{
            name: t("roles.column.name"),
            members: t("roles.column.members"),
            status: t("roles.column.status"),
            system: t("roles.system"),
            empty: t("roles.empty"),
          }}
        />
      </PageLayout>
    </>
  );
}

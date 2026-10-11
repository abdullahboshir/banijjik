import { PERMISSION_KEY, type RoleSummary } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { DetailHeader, EmptyState, StatusBadge } from "@banijjik/ui";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { roleLabelOf } from "../staff/assignment-options";
import type { PermissionGroup, PermissionItem } from "./permission-groups";
import { RoleActions } from "./role-actions";
import { roleArchiveLabelsOf, roleFormGroupsOf, roleFormLabelsOf } from "./role-labels";
import {
  preservedPermissionKeys,
  roleActionsFor,
  roleGroupsOf,
  roleStatusLabel,
} from "./role-view";

const PAGE_SIZE = 100;

function PermissionList({
  items,
  sensitiveMark,
}: {
  items: PermissionItem[];
  sensitiveMark: string;
}): ReactElement {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.permissionKey} className="text-body text-primary">
          {item.label}
          {item.isSensitive ? (
            <span className="ms-2 rounded-full border border-warning px-2 py-0.5 text-caption font-semibold text-warning">
              {sensitiveMark}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function GroupSection({ group, t }: { group: PermissionGroup; t: Translator["t"] }): ReactElement {
  const sensitiveMark = t("roles.sensitive.mark");
  return (
    <section className="rounded-md border border-default bg-surface p-3">
      <h3 className="mb-2 text-body font-semibold text-primary">{group.label}</h3>
      <PermissionList items={group.regular} sensitiveMark={sensitiveMark} />
      {group.sensitive.length > 0 ? (
        <div className="mt-3 border-t border-default pt-2">
          <p className="mb-1 text-small font-semibold text-warning">{t("roles.sensitive.group")}</p>
          <PermissionList items={group.sensitive} sensitiveMark={sensitiveMark} />
        </div>
      ) : null}
    </section>
  );
}

function RoleNote({ role, t }: { role: RoleSummary; t: Translator["t"] }): ReactElement | null {
  if (role.isSystem)
    return <p className="mb-4 text-small text-secondary">{t("roles.detail.systemNote")}</p>;
  if (role.status === "ARCHIVED") {
    return <p className="mb-4 text-small text-secondary">{t("roles.detail.archivedNote")}</p>;
  }
  return null;
}

function RoleHeader({
  role,
  name,
  orgSlug,
  t,
}: {
  role: RoleSummary;
  name: string;
  orgSlug: string;
  t: Translator["t"];
}): ReactElement {
  return (
    <DetailHeader
      title={name}
      backHref={`/${orgSlug}/settings/roles`}
      backLabel={t("roles.back")}
      status={
        <StatusBadge
          requestType="ROLE"
          status={role.status}
          label={roleStatusLabel(role.status, t)}
        />
      }
      facts={<span>{t("roles.members", { count: role.memberCount })}</span>}
    />
  );
}

function PermissionsOverview({
  groups,
  t,
}: {
  groups: PermissionGroup[];
  t: Translator["t"];
}): ReactElement {
  return (
    <>
      <h2 className="mb-2 text-title font-semibold text-primary">
        {t("roles.detail.permissions")}
      </h2>
      {groups.length === 0 ? (
        <p className="text-body text-secondary">{t("roles.detail.none")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <GroupSection key={group.moduleKey} group={group} t={t} />
          ))}
        </div>
      )}
    </>
  );
}

async function loadRole(organizationId: string, roleId: string): Promise<RoleSummary> {
  const roles = await fetchBusinessResource<RoleSummary[]>(
    `/orgs/${organizationId}/roles?limit=${PAGE_SIZE}`,
  );
  const role = roles.data.find((candidate) => candidate.roleId === roleId);
  if (!role) notFound();
  return role;
}

/** `/{orgSlug}/settings/roles/{roleId}`: the permissions of a role grouped by module (13-UX section 4.2). */
export async function RoleDetailPage({
  orgSlug,
  roleId,
}: {
  orgSlug: string;
  roleId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions, permissionDefinitions: definitions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.IAM_ROLE_READ)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const role = await loadRole(organizationId, roleId);
  const name = roleLabelOf(role, t);
  const groupInput = { definitions, permissions, role, translator };
  return (
    <>
      <RoleHeader role={role} name={name} orgSlug={orgSlug} t={t} />
      <RoleNote role={role} t={t} />
      <PermissionsOverview groups={roleGroupsOf({ ...groupInput, mode: "show" })} t={t} />
      <RoleActions
        organizationId={organizationId}
        role={{ roleId: role.roleId, name, version: role.version }}
        actions={roleActionsFor({ role, permissions, canWrite: access.canWrite })}
        groups={roleFormGroupsOf(roleGroupsOf({ ...groupInput, mode: "offer" }), t)}
        preservedKeys={preservedPermissionKeys(role, definitions)}
        formLabels={roleFormLabelsOf(t)}
        archiveLabels={roleArchiveLabelsOf(t, { name, memberCount: role.memberCount })}
        labels={{
          group: t("roles.detail.permissions"),
          edit: t("roles.edit"),
          archive: t("roles.archive"),
        }}
      />
    </>
  );
}

import { CURRENCY_CODE, PERMISSION_KEY, type MemberResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { DetailHeader, EmptyState, PageSection, StatusBadge } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission, holdsPermissionEverywhere } from "../shell/permissions";
import { CustomFieldDetailList } from "../custom-fields/custom-field-detail-list";
import { customFieldPartsOf } from "../custom-fields/custom-field-parts";
import { EditMemberDetailsButton } from "./edit-member-details-button";
import {
  canEditMemberDetails,
  locationNameOf,
  memberActionsFor,
  memberStatusLabel,
  roleNamesOfMember,
  type MemberLookups,
} from "./member-view";
import { MemberActions } from "./member-actions";
import { memberActionLabelsOf } from "./staff-labels";
import { loadStaffLookups } from "./staff-lookups";
import { roleLabelOf } from "./assignment-options";

function Fact({ label, value }: { label: string; value: string | undefined }): ReactElement | null {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-small text-secondary">{label}</dt>
      <dd className="text-body text-primary">{value}</dd>
    </div>
  );
}

function AssignmentList({
  member,
  lookups,
  t,
}: {
  member: MemberResponse;
  lookups: MemberLookups;
  t: Translator["t"];
}): ReactElement {
  if (member.assignments.length === 0)
    return <p className="text-body text-secondary">{t("staff.detail.noAssignments")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {member.assignments.map((assignment) => {
        const role = lookups.roleById.get(assignment.roleId);
        return (
          <li
            key={`${assignment.roleId}-${assignment.locationId}`}
            className="rounded-md border border-default bg-surface p-3 text-body text-primary"
          >
            {role ? roleLabelOf(role, t) : ""}
            {" · "}
            {locationNameOf(assignment.locationId, lookups, t)}
          </li>
        );
      })}
    </ul>
  );
}

/** Sensitive staff details are shown only to someone holding `readSensitive` at every location (ADR-107). */
function canSeeSensitiveDetails(access: OrgAccess): boolean {
  return holdsPermissionEverywhere(
    access.config.permissions,
    PERMISSION_KEY.ORGANIZATION_MEMBER_READ_SENSITIVE,
  );
}

/** The member's extra details with the "Edit details" button for someone who may use it. */
function MemberDetails({
  member,
  lookups,
  access,
  translator,
}: {
  member: MemberResponse;
  lookups: MemberLookups;
  access: OrgAccess;
  translator: Translator;
}): ReactElement | null {
  const { t } = translator;
  const parts = customFieldPartsOf({
    fields: access.config.fields["member"] ?? [],
    values: member.customFields ?? {},
    canSeeSensitive: canSeeSensitiveDetails(access),
    translator,
    timeZone: access.timeZone,
    currencyCode: CURRENCY_CODE.BDT,
  });
  if (parts.list.rows.length === 0) return null;
  const canEdit = canEditMemberDetails({
    member,
    lookups,
    callerUserId: access.me.userId,
    permissions: access.config.permissions,
    canWrite: access.canWrite,
  });
  return (
    <div className="flex flex-col gap-6">
      <CustomFieldDetailList {...parts.list} />
      {canEdit ? (
        <div>
          <EditMemberDetailsButton
            label={t("staff.action.editDetails")}
            sheetProps={{
              organizationId: access.organization.organizationId,
              memberId: member.memberId,
              version: member.version,
              customFields: parts.form,
              labels: {
                title: t("staff.action.editDetails"),
                close: t("shell.closeMenu"),
                save: t("common.save"),
                conflict: t("staff.conflict"),
                reload: t("staff.reload"),
              },
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function formatJoinedDate(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(iso));
}

function MemberOverview({
  member,
  lookups,
  access,
  translator,
}: {
  member: MemberResponse;
  lookups: MemberLookups;
  access: OrgAccess;
  translator: Translator;
}): ReactElement {
  const { t, locale } = translator;
  const orgSlug = access.organization.slug;
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        title={member.displayName}
        backHref={`/${orgSlug}/settings/staff`}
        backLabel={t("staff.detail.back")}
        status={
          <StatusBadge
            requestType="MEMBER"
            status={member.status}
            label={memberStatusLabel(member.status, t)}
          />
        }
        facts={<span>{roleNamesOfMember(member, lookups, t)}</span>}
      />
      <dl className="grid gap-4 md:grid-cols-3">
        <Fact label={t("staff.detail.jobTitle")} value={member.jobTitle} />
        <Fact label={t("staff.detail.employeeNumber")} value={member.employeeNumber} />
        <Fact
          label={t("staff.detail.joined")}
          value={formatJoinedDate(member.joinedAt, locale, access.timeZone)}
        />
      </dl>
      <PageSection title={t("staff.detail.assignments")} help={t("staff.detail.assignments.help")}>
        <AssignmentList member={member} lookups={lookups} t={t} />
      </PageSection>
    </div>
  );
}

/** `/{orgSlug}/settings/staff/{memberId}`: key facts, assignments and the actions (13-UX section 4.2). */
export async function StaffDetailPage({
  orgSlug,
  memberId,
}: {
  orgSlug: string;
  memberId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_MEMBER_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const [memberResult, lookups] = await Promise.all([
    fetchBusinessResource<MemberResponse>(`/orgs/${organizationId}/members/${memberId}`),
    loadStaffLookups(access, t),
  ]);
  const member = memberResult.data;
  const actions = memberActionsFor({
    member,
    lookups,
    callerUserId: access.me.userId,
    permissions,
    canWrite: access.canWrite,
    canChooseAssignments: lookups.options !== undefined,
  });
  return (
    <div className="flex flex-col gap-6">
      <MemberOverview member={member} lookups={lookups} access={access} translator={translator} />
      <MemberDetails member={member} lookups={lookups} access={access} translator={translator} />
      <MemberActions
        organizationId={organizationId}
        member={{
          memberId: member.memberId,
          version: member.version,
          assignments: member.assignments,
        }}
        actions={actions}
        options={lookups.options}
        labels={memberActionLabelsOf(t, member.displayName)}
      />
    </div>
  );
}

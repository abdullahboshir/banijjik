import {
  INVITATION_STATUS,
  PERMISSION_KEY,
  type InvitationResponse,
  type InvitationStatus,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageHeader, formatPhoneForDisplay } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { roleNamesOfMember } from "../staff/member-view";
import { assignmentLabelsOf } from "../staff/staff-labels";
import { loadStaffLookups, type StaffLookups } from "../staff/staff-lookups";
import { InvitationList, type InvitationRowView } from "./invitation-list";
import type { InviteLabels } from "./invite-labels";
import { NewInvitationButton } from "./new-invitation-button";

const PAGE_SIZE = 50;
const STATUS_LABEL_KEY: Record<InvitationStatus, string> = {
  [INVITATION_STATUS.PENDING]: "invitations.status.pending",
  [INVITATION_STATUS.ACCEPTED]: "invitations.status.accepted",
  [INVITATION_STATUS.REVOKED]: "invitations.status.revoked",
  [INVITATION_STATUS.EXPIRED]: "invitations.status.expired",
};

function inviteLabelsOf(t: Translator["t"]): InviteLabels {
  return {
    title: t("staff.invite"),
    identifier: t("auth.field.identifier"),
    identifierHint: t("auth.field.identifierHint"),
    displayName: t("invite.field.displayName"),
    submit: t("invite.submit"),
    close: t("shell.closeMenu"),
    linkTitle: t("invite.link.title"),
    linkHint: t("invite.link.hint"),
    linkField: t("invite.link.title"),
    copy: t("invite.link.copy"),
    copied: t("invite.link.copied"),
    copyFailed: t("invite.link.copyFailed"),
    done: t("invite.link.done"),
    assignments: assignmentLabelsOf(t),
  };
}

function personOf(invitation: InvitationResponse): string {
  const identifier =
    invitation.email ?? (invitation.phoneE164 ? formatPhoneForDisplay(invitation.phoneE164) : "");
  return invitation.displayName ? `${invitation.displayName} · ${identifier}` : identifier;
}

function toRow(input: {
  invitation: InvitationResponse;
  lookups: StaffLookups;
  access: OrgAccess;
  t: Translator["t"];
  locale: string;
}): InvitationRowView {
  const { invitation, lookups, access, t, locale } = input;
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: access.timeZone,
  });
  return {
    invitationId: invitation.invitationId,
    version: invitation.version,
    person: personOf(invitation),
    roles: roleNamesOfMember(invitation, lookups, t),
    expires: dateFormat.format(new Date(invitation.expiresAt)),
    status: invitation.status,
    statusLabel: t(STATUS_LABEL_KEY[invitation.status]),
    canRevoke: access.canWrite && invitation.status === INVITATION_STATUS.PENDING,
  };
}

/** `/{orgSlug}/settings/staff/invitations`: who was invited and what became of it. */
export async function InvitationsPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t, locale } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const [invitations, lookups] = await Promise.all([
    fetchBusinessResource<InvitationResponse[], PageMeta>(
      `/orgs/${organizationId}/invitations?limit=${PAGE_SIZE}`,
    ),
    loadStaffLookups(access, t),
  ]);
  const rows = invitations.data.map((invitation) =>
    toRow({ invitation, lookups, access, t, locale }),
  );
  return (
    <>
      <PageHeader
        title={t("invitations.title")}
        actions={
          access.canWrite && lookups.options ? (
            <NewInvitationButton
              organizationId={organizationId}
              options={lookups.options}
              labels={inviteLabelsOf(t)}
              buttonLabel={t("invitations.create")}
            />
          ) : null
        }
      />
      <InvitationList
        organizationId={organizationId}
        rows={rows}
        labels={{
          person: t("invitations.column.person"),
          roles: t("invitations.column.roles"),
          expires: t("invitations.column.expires"),
          status: t("invitations.column.status"),
          empty: t("invitations.empty"),
          revoke: t("invitations.revoke"),
          revokeDialog: {
            title: t("invitations.revoke.title"),
            description: t("invitations.revoke.description"),
            confirm: t("invitations.revoke"),
            cancel: t("common.cancel"),
            close: t("shell.closeMenu"),
            conflict: t("staff.conflict"),
          },
        }}
      />
    </>
  );
}

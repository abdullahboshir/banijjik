import type {
  InvitationCreatedResponse,
  InvitationCreateRequest,
  InvitationResponse,
  MemberResponse,
  MemberUpdateRequest,
  MyOrganizationSummary,
} from "@banijjik/contracts";
import { apiFetch } from "./api-client";

export type MemberStatusAction = "suspend" | "reactivate" | "remove";

/** `PATCH /orgs/{organizationId}/members/{memberId}`: names and assignments, with the version read. */
export async function updateMember(
  organizationId: string,
  memberId: string,
  body: MemberUpdateRequest,
): Promise<MemberResponse> {
  const result = await apiFetch<MemberResponse>(`/orgs/${organizationId}/members/${memberId}`, {
    method: "PATCH",
    body,
  });
  return result.data;
}

/** `POST …/members/{memberId}/suspend | reactivate | remove`. */
export interface MemberStatusChange {
  organizationId: string;
  memberId: string;
  action: MemberStatusAction;
  version: number;
}

export async function changeMemberStatus(change: MemberStatusChange): Promise<MemberResponse> {
  const { organizationId, memberId, action, version } = change;
  const result = await apiFetch<MemberResponse>(
    `/orgs/${organizationId}/members/${memberId}/${action}`,
    { method: "POST", body: { version } },
  );
  return result.data;
}

/** `POST /orgs/{organizationId}/invitations`; the answer carries the one-time link. */
export async function createInvitation(
  organizationId: string,
  body: InvitationCreateRequest,
  idempotencyKey: string,
): Promise<InvitationCreatedResponse> {
  const result = await apiFetch<InvitationCreatedResponse>(`/orgs/${organizationId}/invitations`, {
    method: "POST",
    body,
    idempotencyKey,
  });
  return result.data;
}

export async function revokeInvitation(
  organizationId: string,
  invitationId: string,
  version: number,
): Promise<InvitationResponse> {
  const result = await apiFetch<InvitationResponse>(
    `/orgs/${organizationId}/invitations/${invitationId}/revoke`,
    { method: "POST", body: { version } },
  );
  return result.data;
}

/** `POST /invitations/{token}/accept`: the invited person joins; the answer is their new business. */
export async function acceptInvitation(token: string): Promise<MyOrganizationSummary> {
  const result = await apiFetch<MyOrganizationSummary>(`/invitations/${token}/accept`, {
    method: "POST",
  });
  return result.data;
}

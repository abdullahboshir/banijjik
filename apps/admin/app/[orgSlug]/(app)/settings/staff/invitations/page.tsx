import type { ReactElement } from "react";
import { InvitationsPage } from "../../../../../../src/invitations/invitations-page";

export default async function StaffInvitationsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <InvitationsPage orgSlug={orgSlug} />;
}

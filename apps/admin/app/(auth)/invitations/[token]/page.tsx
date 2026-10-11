import type { ReactElement } from "react";
import { InvitationAcceptPage } from "../../../../src/invitations/invitation-accept-page";

export default async function AcceptInvitationRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<ReactElement> {
  const { token } = await params;
  return <InvitationAcceptPage token={token} />;
}

import {
  ERROR_HTTP_STATUS,
  type InvitationPreviewResponse,
  type MeResponse,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { buttonVariants, EmptyState, PageHeader } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { buildSignInPath } from "../auth/safe-next-path";
import { ApiError } from "../lib/api/api-error";
import { serverApiFetch, serverPublicApiFetch } from "../lib/api/server-api-fetch";
import { getTranslator } from "../lib/i18n/get-translator";
import { AcceptInvitationButton } from "./accept-invitation-button";

/** An unknown, expired, revoked or used token is 404; a token of the wrong shape is 400 (14-API.md section 4). */
const INVALID_TOKEN_STATUSES: readonly number[] = [
  ERROR_HTTP_STATUS.NOT_FOUND,
  ERROR_HTTP_STATUS.VALIDATION_ERROR,
];

async function loadPreview(token: string): Promise<InvitationPreviewResponse | undefined> {
  try {
    return (await serverPublicApiFetch<InvitationPreviewResponse>(`/invitations/${token}`)).data;
  } catch (error) {
    if (error instanceof ApiError && INVALID_TOKEN_STATUSES.includes(error.status))
      return undefined;
    throw error;
  }
}

/** The signed-in person, or undefined for a visitor; the page works for both and never redirects. */
async function loadVisitor(): Promise<MeResponse | undefined> {
  try {
    return (await serverApiFetch<MeResponse>("/me")).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === ERROR_HTTP_STATUS.UNAUTHENTICATED)
      return undefined;
    throw error;
  }
}

function SignedOutActions({ token, t }: { token: string; t: Translator["t"] }): ReactElement {
  const next = `/invitations/${token}`;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-secondary">{t("accept.signedOut")}</p>
      <Link href={buildSignInPath(next)} className={buttonVariants({ variant: "primary" })}>
        {t("auth.signIn.submit")}
      </Link>
      <Link
        href={`/sign-up?next=${encodeURIComponent(next)}`}
        className={buttonVariants({ variant: "secondary" })}
      >
        {t("auth.signUp.submit")}
      </Link>
    </div>
  );
}

/** `/invitations/{token}`: what the invitation is, and a way to accept it (13-UX section 5, plan 1.7c decision 10). */
export async function InvitationAcceptPage({ token }: { token: string }): Promise<ReactElement> {
  const [{ t }, preview, visitor] = await Promise.all([
    getTranslator(),
    loadPreview(token),
    loadVisitor(),
  ]);
  if (!preview) return <EmptyState message={t("accept.invalid")} />;
  return (
    <>
      <PageHeader title={t("accept.title")} />
      <p className="text-body text-primary">
        {t("accept.body", {
          inviter: preview.invitedByDisplayName,
          business: preview.organizationName,
        })}
      </p>
      <p className="text-body text-secondary">
        {t("accept.identifier", { hint: preview.identifierHint })}
      </p>
      {visitor ? (
        <>
          <p className="text-small text-secondary">
            {t("accept.signedInAs", { name: visitor.name })}
          </p>
          <AcceptInvitationButton
            token={token}
            labels={{
              submit: t("accept.submit"),
              invalid: t("accept.invalid"),
              mismatchHint: t("accept.mismatchHint", { hint: preview.identifierHint }),
              switchAccount: t("accept.switchAccount"),
            }}
          />
        </>
      ) : (
        <SignedOutActions token={token} t={t} />
      )}
    </>
  );
}

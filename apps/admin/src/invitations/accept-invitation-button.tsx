"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { Button } from "@banijjik/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { signOut } from "../auth/sign-out";
import { ApiError } from "../lib/api/api-error";
import { acceptInvitation } from "../lib/api/organization-api";
import { useTranslator } from "../lib/i18n/i18n-provider";

export interface AcceptInvitationButtonProps {
  token: string;
  labels: {
    submit: string;
    invalid: string;
    mismatchHint: string;
    switchAccount: string;
  };
}

type Outcome = "none" | "invalid" | "mismatch" | { messageKey: string };

function outcomeOf(error: ApiError): Outcome {
  if (error.code === ERROR_CODE.NOT_FOUND) return "invalid";
  if (error.code === ERROR_CODE.FORBIDDEN) return "mismatch";
  return { messageKey: knownMessageKeyOrInternal(error.messageKey) };
}

/** Accepts the invitation, then loads the new business with a full navigation (ADR-022). */
export function AcceptInvitationButton({
  token,
  labels,
}: AcceptInvitationButtonProps): ReactElement {
  const { t } = useTranslator();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome>("none");
  const [isWorking, setIsWorking] = useState(false);

  async function accept(): Promise<void> {
    setIsWorking(true);
    try {
      const organization = await acceptInvitation(token);
      window.location.assign(new URL(`/${organization.slug}`, window.location.origin));
      return;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setOutcome(outcomeOf(error));
    }
    setIsWorking(false);
  }

  async function switchAccount(): Promise<void> {
    await signOut(queryClient, `/invitations/${token}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button isLoading={isWorking} onClick={() => void accept()}>
        {labels.submit}
      </Button>
      {outcome === "invalid" ? (
        <p role="alert" className="text-small text-danger">
          {labels.invalid}
        </p>
      ) : null}
      {outcome === "mismatch" ? (
        <div role="alert" className="flex flex-col gap-2 text-small text-danger">
          <p>{t("errors.invitation_identifier_mismatch")}</p>
          <p>{labels.mismatchHint}</p>
          <Button variant="secondary" onClick={() => void switchAccount()}>
            {labels.switchAccount}
          </Button>
        </div>
      ) : null}
      {typeof outcome === "object" ? (
        <p role="alert" className="text-small text-danger">
          {t(outcome.messageKey)}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "../lib/api/api-error";
import { failureOfApiError } from "../settings/form-failure";

export interface RecordFailure {
  isConflict: boolean;
  /** The message key the API sent, when it is not a conflict. */
  messageKey: string | undefined;
}

export interface RecordAction {
  failure: RecordFailure | undefined;
  isBusy: boolean;
  /** Runs one write, reads the page again on success and tells whether it went through. */
  run: (write: () => Promise<unknown>) => Promise<boolean>;
  reload: () => void;
}

/** The busy / refused / refresh cycle the category and add-on lists share. */
export function useRecordAction(): RecordAction {
  const router = useRouter();
  const [failure, setFailure] = useState<RecordFailure | undefined>();
  const [isBusy, setIsBusy] = useState(false);

  async function run(write: () => Promise<unknown>): Promise<boolean> {
    setFailure(undefined);
    setIsBusy(true);
    try {
      await write();
      router.refresh();
      setIsBusy(false);
      return true;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const refused = failureOfApiError(error, []);
      setFailure({ isConflict: refused.isConflict, messageKey: error.messageKey });
    }
    setIsBusy(false);
    return false;
  }

  return { failure, isBusy, run, reload: () => router.refresh() };
}

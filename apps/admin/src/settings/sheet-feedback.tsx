"use client";

import type { ReactElement } from "react";
import { ConflictNotice } from "./conflict-notice";
import { FormMessage } from "./form-message";
import type { SheetSubmitState } from "./use-sheet-submit";

/** What sits under the inputs of a settings sheet: the 409 reload hint and any other refusal (403, 422). */
export function SheetFeedback({
  state,
  conflict,
  reload,
}: {
  state: SheetSubmitState;
  conflict: string;
  reload: string;
}): ReactElement {
  return (
    <>
      {state.failure.isConflict ? (
        <ConflictNotice message={conflict} reloadLabel={reload} onReload={state.reload} />
      ) : null}
      <FormMessage failure={state.failure} />
    </>
  );
}

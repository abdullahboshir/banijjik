import type { AssignmentLabels } from "./assignment-labels";

export type MemberAction = "editAssignments" | "suspend" | "reactivate" | "remove";

/** All text of the member actions, translated on the server. */
export interface MemberActionLabels {
  group: string;
  actions: Record<MemberAction, string>;
  /** Title and description of the confirmation of suspend, reactivate and remove. */
  confirm: Record<"suspend" | "reactivate" | "remove", { title: string; description: string }>;
  cancel: string;
  close: string;
  save: string;
  conflict: string;
  reload: string;
  assignments: AssignmentLabels;
}

export interface MemberSummary {
  memberId: string;
  version: number;
  assignments: { roleId: string; locationId: string }[];
}

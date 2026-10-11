import type { AssignmentLabels } from "../staff/assignment-labels";

/** All text of the invitation form and the one-time link, translated on the server. */
export interface InviteLabels {
  title: string;
  identifier: string;
  identifierHint: string;
  displayName: string;
  submit: string;
  close: string;
  linkTitle: string;
  linkHint: string;
  linkField: string;
  copy: string;
  copied: string;
  copyFailed: string;
  done: string;
  assignments: AssignmentLabels;
}

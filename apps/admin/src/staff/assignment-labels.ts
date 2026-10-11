/** Text of the assignment rows, translated on the server (the browser bundle does not carry screen catalogs). */
export interface AssignmentLabels {
  /** Contains `{number}`. */
  row: string;
  role: string;
  location: string;
  chooseRole: string;
  chooseLocation: string;
  add: string;
  /** Contains `{number}`. */
  remove: string;
  duplicate: string;
}

/** Fills `{number}` in a label that arrived from the server. */
export function withNumber(template: string, number: number): string {
  return template.replace("{number}", String(number));
}

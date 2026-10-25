import type { FieldProblem } from "../api/client-api";

const REQUIRED_MESSAGE_KEY = "validation.required";
const REQUIRED_TEXT_KEY = "storefront.error.fieldRequired";
const INVALID_TEXT_KEY = "storefront.error.fieldInvalid";

/** The storefront text key for one API field problem (the API names the rule, not the words). */
export function problemTextKey(problem: FieldProblem): string {
  return problem.messageKey === REQUIRED_MESSAGE_KEY ? REQUIRED_TEXT_KEY : INVALID_TEXT_KEY;
}

import type {
  ListingResponse,
  StorefrontDirectoryFormResponse,
} from "@banijjik/contracts/directory";
import type { FieldProblem } from "../api/client-api";
import { fieldsOfSection, stepIndexOfPath } from "../fields/field-rules";

type SectionLabel = StorefrontDirectoryFormResponse["sections"][number]["label"];

export interface SectionStep {
  readonly kind: "section";
  readonly sectionKey: string;
  readonly label: SectionLabel;
  readonly fieldKeys: readonly string[];
}

export interface ConsentStep {
  readonly kind: "consents";
}

/** One step of the biodata form: a template section, then (when the template has any) the consents. */
export type ListingStep = SectionStep | ConsentStep;

export function listingStepsOf(form: StorefrontDirectoryFormResponse): readonly ListingStep[] {
  const sectionKeys = form.sections.map((section) => section.sectionKey);
  const sectionSteps: ListingStep[] = form.sections.map((section) => ({
    kind: "section",
    sectionKey: section.sectionKey,
    label: section.label,
    fieldKeys: fieldsOfSection(form.fields, sectionKeys, section.sectionKey).map(
      (field) => field.fieldKey,
    ),
  }));
  if (form.consents.length === 0) return sectionSteps;
  return [...sectionSteps, { kind: "consents" }];
}

/** The step index of each field key, for the errors the API names by `customFields.<fieldKey>`. */
export function stepOfProblems(
  problems: readonly FieldProblem[],
  steps: readonly ListingStep[],
): { readonly stepIndex: number; readonly fieldKey: string }[] {
  const keysByStep = steps.map((step) => (step.kind === "section" ? step.fieldKeys : []));
  return problems.map((problem) => ({
    stepIndex: stepIndexOfPath(problem.path, keysByStep),
    fieldKey: problem.path.replace(/^customFields\./, ""),
  }));
}

/** The index of the first step that still has a required field without an answer, or -1. */
export function firstStepWithMissing(
  steps: readonly ListingStep[],
  missingKeysOf: (fieldKeys: readonly string[]) => readonly string[],
): number {
  return steps.findIndex(
    (step) => step.kind === "section" && missingKeysOf(step.fieldKeys).length > 0,
  );
}

/** A draft or a rejected listing can be changed and submitted again; any other status is read-only. */
export function listingIsOpenForEditing(listing: ListingResponse | undefined): boolean {
  if (listing === undefined) return true;
  return listing.status === "DRAFT" || listing.status === "REJECTED";
}

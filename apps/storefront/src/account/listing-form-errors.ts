"use client";

import { useState } from "react";
import type { FieldProblem } from "../api/client-api";
import { problemTextKey } from "./listing-problem-text";
import { stepOfProblems, type ListingStep } from "./listing-steps";

const GENERIC_TEXT_KEY = "storefront.error.generic";
const REQUIRED_TEXT_KEY = "storefront.error.fieldRequired";

export interface ListingFormErrors {
  readonly errors: Readonly<Record<string, string>>;
  readonly clearError: (fieldKey: string) => void;
  /** Marks the given fields as required-missing; returns true when none is missing. */
  readonly markMissing: (missing: readonly string[]) => boolean;
  /** Shows the API's field problems on their steps; returns the first step to show, if any. */
  readonly showProblems: (
    problems: readonly FieldProblem[],
    steps: readonly ListingStep[],
  ) => {
    readonly firstStep: number | undefined;
    readonly generic: boolean;
  };
}

function withoutKey(record: Readonly<Record<string, string>>, key: string): Record<string, string> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

/** The text key of each field that has an error, from the client check or the API's answer. */
export function useListingFormErrors(): ListingFormErrors {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return {
    errors,
    clearError: (fieldKey) => setErrors((current) => withoutKey(current, fieldKey)),
    markMissing: (missing) => {
      if (missing.length === 0) return true;
      setErrors(Object.fromEntries(missing.map((key) => [key, REQUIRED_TEXT_KEY])));
      return false;
    },
    showProblems: (problems, steps) => {
      if (problems.length === 0) return { firstStep: undefined, generic: true };
      const located = stepOfProblems(problems, steps);
      const nextErrors: Record<string, string> = {};
      problems.forEach((problem, index) => {
        nextErrors[located[index]?.fieldKey ?? ""] = problemTextKey(problem);
      });
      setErrors(nextErrors);
      return { firstStep: located.find((item) => item.stepIndex >= 0)?.stepIndex, generic: false };
    },
  };
}

export { GENERIC_TEXT_KEY };

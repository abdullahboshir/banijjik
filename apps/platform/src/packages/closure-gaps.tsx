"use client";

import type { ModuleKey } from "@banijjik/contracts";
import type { ReactElement } from "react";
import type { ClosureGap } from "../forms/api-failure";

export interface ClosureGapsProps {
  gaps: ClosureGap[];
  title: string;
  /** "{module} needs {dependency}": the text with both placeholders still in it. */
  pattern: string;
  moduleLabels: Record<ModuleKey, string>;
}

function nameOf(moduleKey: string, moduleLabels: Record<ModuleKey, string>): string {
  // Safe: only a lookup; a key the catalogue does not know falls back to the raw key.
  return moduleLabels[moduleKey as ModuleKey] ?? moduleKey;
}

/** Which dependency a package is missing, when the API refuses to save it as not closed. */
export function ClosureGaps({
  gaps,
  title,
  pattern,
  moduleLabels,
}: ClosureGapsProps): ReactElement | null {
  if (gaps.length === 0) return null;
  return (
    <div role="alert" className="rounded-md border border-danger p-3">
      <p className="text-small font-semibold text-danger">{title}</p>
      <ul className="mt-1 list-disc ps-5 text-small text-danger">
        {gaps.map((gap) => (
          <li key={`${gap.moduleKey}-${gap.missingDependency}`}>
            {pattern
              .replace("{module}", nameOf(gap.moduleKey, moduleLabels))
              .replace("{dependency}", nameOf(gap.missingDependency, moduleLabels))}
          </li>
        ))}
      </ul>
    </div>
  );
}

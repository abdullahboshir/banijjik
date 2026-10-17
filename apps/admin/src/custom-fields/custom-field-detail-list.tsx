import { PageSection } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { DetailRow } from "./custom-field-display";

export interface CustomFieldDetailListProps {
  title: string;
  help: string;
  rows: readonly DetailRow[];
  notSetLabel: string;
  hiddenLabel: string;
}

/** The read-only "Additional details" of a business or a team member; drawn only when there are fields to show. */
export function CustomFieldDetailList(props: CustomFieldDetailListProps): ReactElement | null {
  if (props.rows.length === 0) return null;
  return (
    <PageSection title={props.title} help={props.help}>
      <dl className="grid gap-4 md:grid-cols-3">
        {props.rows.map((row) => (
          <div key={row.fieldKey} className="flex flex-col gap-1">
            <dt className="text-small text-secondary">{row.label}</dt>
            <dd className="break-words text-body text-primary">
              {row.isHidden ? props.hiddenLabel : (row.text ?? props.notSetLabel)}
            </dd>
          </div>
        ))}
      </dl>
    </PageSection>
  );
}

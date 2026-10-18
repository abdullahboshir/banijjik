import { PageSection } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import type { DetailRow } from "./custom-field-display";

export interface CustomFieldDetailListProps {
  title: string;
  help: string;
  rows: readonly DetailRow[];
  notSetLabel: string;
  hiddenLabel: string;
}

function DetailValue(props: {
  row: DetailRow;
  hiddenLabel: string;
  notSetLabel: string;
}): ReactElement {
  const { row } = props;
  if (row.isHidden) return <>{props.hiddenLabel}</>;
  if (row.text === undefined) return <>{props.notSetLabel}</>;
  if (row.href === undefined) return <>{row.text}</>;
  return (
    <Link href={row.href} className="text-brand underline">
      {row.text}
    </Link>
  );
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
              <DetailValue
                row={row}
                hiddenLabel={props.hiddenLabel}
                notSetLabel={props.notSetLabel}
              />
            </dd>
          </div>
        ))}
      </dl>
    </PageSection>
  );
}

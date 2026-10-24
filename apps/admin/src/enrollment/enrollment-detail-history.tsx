import type { EnrollmentResponse } from "@banijjik/contracts/enrollment";
import type { ReactElement } from "react";

export function EnrollmentDetailHistory(props: {
  history: EnrollmentResponse["history"];
  title: string;
  actionNames: Readonly<Record<string, string>>;
}): ReactElement | null {
  if (props.history.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-body font-semibold text-primary">{props.title}</h2>
      <ul className="flex flex-col gap-2">
        {props.history.map((entry, index) => (
          <li
            key={`${entry.on}-${index}`}
            className="rounded-md border border-default px-3 py-2 text-small"
          >
            <span className="text-primary">{props.actionNames[entry.action] ?? entry.action}</span>
            <span className="text-secondary"> · {entry.on}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

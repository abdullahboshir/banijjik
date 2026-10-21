import type { BookingResponse } from "@banijjik/contracts/booking";
import type { ReactElement } from "react";

export function BookingDetailHistory(props: {
  history: BookingResponse["history"];
  title: string;
}): ReactElement | null {
  if (props.history.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-body font-semibold text-primary">{props.title}</h2>
      <ul className="flex flex-col gap-2">
        {props.history.map((entry, index) => (
          <li
            key={`${entry.at}-${index}`}
            className="rounded-md border border-default px-3 py-2 text-small"
          >
            <span className="text-primary">{entry.action}</span>
            <span className="text-secondary"> · {entry.at}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

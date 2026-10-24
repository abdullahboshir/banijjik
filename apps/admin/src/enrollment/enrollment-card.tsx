import type { EnrollmentResponse } from "@banijjik/contracts/enrollment";
import { StatusBadge } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";

/** One enrollment as a card: the same markup serves the phone and the desktop. */
export function EnrollmentCard(props: {
  href: string;
  enrollment: EnrollmentResponse;
  contactName: string;
  planName: string;
  statusLabel: string;
  startsLabel: string;
}): ReactElement {
  const { enrollment } = props;
  return (
    <li>
      <Link
        href={props.href}
        className="flex min-h-11 flex-col gap-1 rounded-lg border border-default bg-surface p-4"
      >
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-body font-semibold text-primary">
            {enrollment.enrollmentNumber}
          </span>
          <StatusBadge
            requestType="ENROLLMENT"
            status={enrollment.status}
            label={props.statusLabel}
          />
        </span>
        <span className="text-body text-primary">{props.contactName}</span>
        <span className="text-small text-secondary">
          {props.planName} · {props.startsLabel}
        </span>
      </Link>
    </li>
  );
}

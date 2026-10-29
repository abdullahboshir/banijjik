"use client";

import type { DnsInstruction } from "@banijjik/contracts/website";
import { Button } from "@banijjik/ui";
import { useState, type ReactElement } from "react";

export interface DomainDnsInstructionsProps {
  readonly title: string;
  readonly records: readonly DnsInstruction[];
  readonly waitLabel: string;
  readonly copyLabel: string;
  readonly copiedLabel: string;
}

async function copyValue(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    void error;
    return false;
  }
}

function DnsRecordRow(props: {
  readonly record: DnsInstruction;
  readonly copyLabel: string;
  readonly copiedLabel: string;
}): ReactElement {
  const [copied, setCopied] = useState(false);
  async function copy(): Promise<void> {
    const ok = await copyValue(props.record.value);
    setCopied(ok);
  }
  return (
    <li className="flex flex-col gap-2 rounded-md border border-default p-3">
      <p className="text-small font-semibold text-primary">{props.record.type}</p>
      <p className="break-all text-small text-secondary">{props.record.name}</p>
      <p className="break-all text-body text-primary">{props.record.value}</p>
      <Button type="button" variant="secondary" onClick={() => void copy()}>
        {copied ? props.copiedLabel : props.copyLabel}
      </Button>
    </li>
  );
}

/** Ownership or certificate records the person copies into their DNS host. */
export function DomainDnsInstructions(props: DomainDnsInstructionsProps): ReactElement {
  if (props.records.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-body font-semibold text-primary">{props.title}</h3>
        <p className="text-small text-secondary">{props.waitLabel}</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body font-semibold text-primary">{props.title}</h3>
      <ul className="flex flex-col gap-3">
        {props.records.map((record) => (
          <DnsRecordRow
            key={`${record.type}:${record.name}:${record.value}`}
            record={record}
            copyLabel={props.copyLabel}
            copiedLabel={props.copiedLabel}
          />
        ))}
      </ul>
    </section>
  );
}

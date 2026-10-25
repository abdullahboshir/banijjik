"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { PosZReport } from "@banijjik/contracts/pos";
import { Button, type DisplayLocale } from "@banijjik/ui";
import { useEffect, useState, type ReactElement } from "react";
import type { PosLabels } from "./pos-labels";
import { PosCountForm } from "./pos-count-form";
import { loadCloseStep, type CloseStep } from "./pos-close-step";
import { PosZReportView } from "./pos-z-report";

export interface PosCloseScreenProps {
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly onBack: () => void;
  readonly onDone: () => void;
}

type CloseView = CloseStep | { readonly kind: "report"; readonly report: PosZReport };

function StepMessage(props: {
  readonly text: string;
  readonly doneLabel: string;
  readonly onDone: () => void;
}): ReactElement {
  const { text, doneLabel, onDone } = props;
  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <p role="alert" className="text-body text-danger">
        {text}
      </p>
      <Button className="min-h-14" onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  );
}

/** Renders the one step the close is on. The counting form and the Z-report share this screen. */
function CloseStepView(props: {
  readonly view: CloseView;
  readonly screen: PosCloseScreenProps;
  readonly onReport: (report: PosZReport) => void;
}): ReactElement {
  const { view, screen, onReport } = props;
  const { organizationId, currency, locale, labels } = screen;
  if (view.kind === "loading") {
    return <p className="p-4 text-body text-secondary">{labels.loading}</p>;
  }
  if (view.kind === "noOpen") {
    return (
      <StepMessage
        text={labels.closeLabels.noOpen}
        doneLabel={labels.zReportLabels.done}
        onDone={screen.onDone}
      />
    );
  }
  if (view.kind === "loadFailed") {
    return (
      <StepMessage
        text={labels.loadFailed}
        doneLabel={labels.closeLabels.back}
        onDone={screen.onBack}
      />
    );
  }
  if (view.kind === "count") {
    return (
      <PosCountForm
        organizationId={organizationId}
        session={view.session}
        currency={currency}
        labels={labels}
        onBack={screen.onBack}
        onClosed={onReport}
      />
    );
  }
  return (
    <PosZReportView report={view.report} labels={labels} locale={locale} onDone={screen.onDone} />
  );
}

/** Counts the drawer and closes the register, then shows the Z-report to print. */
export function PosCloseScreen(props: PosCloseScreenProps): ReactElement {
  const { organizationId } = props;
  const [view, setView] = useState<CloseView>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function loadStep(): Promise<void> {
      const step = await loadCloseStep(organizationId);
      if (!cancelled) setView(step);
    }
    void loadStep();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return (
    <CloseStepView
      view={view}
      screen={props}
      onReport={(report) => setView({ kind: "report", report })}
    />
  );
}

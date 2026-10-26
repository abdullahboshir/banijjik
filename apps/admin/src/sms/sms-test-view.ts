import type { SmsTestResult } from "./sms-api";
import { fillLabel } from "../catalog/catalog-labels";
import type { SmsSettingsLabels } from "./sms-labels";

/** The words of one test send: the outcome, the failure reason when there is one, and which account sent it. */
export interface TestResultView {
  readonly outcome: string;
  readonly failure: string | undefined;
  readonly through: string;
}

export function testResultViewOf(result: SmsTestResult, labels: SmsSettingsLabels): TestResultView {
  return {
    outcome: labels.outcomeNames[result.outcome],
    failure: result.failureReason === null ? undefined : labels.failureNames[result.failureReason],
    through: fillLabel(labels.test.through, { via: labels.sourceNames[result.source] }),
  };
}

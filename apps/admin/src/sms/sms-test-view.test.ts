import {
  SMS_FAILURE_REASON,
  SMS_OUTCOME,
  SMS_PROVIDER,
  SMS_PURPOSE,
  SMS_SOURCE,
} from "@banijjik/contracts/sms";
import { BUNDLED_CATALOGS, SCREEN_CATALOGS } from "@banijjik/i18n";
import { describe, expect, it } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";
import { smsSettingsLabelsOf } from "./sms-labels";
import { testResultViewOf } from "./sms-test-view";

const labels = smsSettingsLabelsOf(banglaTranslator().t);

describe("the outcome of a test send, in words", () => {
  it("names the account that sent the message", () => {
    const view = testResultViewOf(
      {
        source: SMS_SOURCE.PLATFORM,
        provider: SMS_PROVIDER.BULKSMSBD,
        outcome: SMS_OUTCOME.SENT,
        failureReason: null,
        providerErrorCode: null,
      },
      labels,
    );

    expect(view.outcome).toBe(labels.outcomeNames[SMS_OUTCOME.SENT]);
    expect(view.failure).toBeUndefined();
    expect(view.through).toContain(labels.sourceNames[SMS_SOURCE.PLATFORM]);
  });

  it("shows the failure reason in words, never the raw code", () => {
    const view = testResultViewOf(
      {
        source: SMS_SOURCE.ORGANIZATION,
        provider: SMS_PROVIDER.ADAREACH,
        outcome: SMS_OUTCOME.REFUSED,
        failureReason: SMS_FAILURE_REASON.BALANCE_LOW,
        providerErrorCode: 1506,
      },
      labels,
    );

    expect(view.failure).toBe(labels.failureNames[SMS_FAILURE_REASON.BALANCE_LOW]);
    expect(view.failure).not.toContain("BALANCE_LOW");
  });
});

describe("every SMS value has a message in both languages", () => {
  const screenBn = SCREEN_CATALOGS.bn;
  const bundledBn = BUNDLED_CATALOGS.bn;

  it.each(Object.values(SMS_OUTCOME))("has a Bangla outcome message for %s", (outcome) => {
    const text = bundledBn[`sms.outcome.${outcome}`];

    expect(text).toBeTruthy();
    expect(labels.outcomeNames[outcome]).toBe(text);
  });

  it.each(Object.values(SMS_FAILURE_REASON))("has a Bangla failure message for %s", (reason) => {
    const text = bundledBn[`sms.failure.${reason}`];

    expect(text).toBeTruthy();
    expect(labels.failureNames[reason]).toBe(text);
  });

  it.each(Object.values(SMS_PURPOSE))("has a Bangla purpose label for %s", (purpose) => {
    expect(screenBn[`sms.purpose.${purpose}`]).toBeTruthy();
  });
});

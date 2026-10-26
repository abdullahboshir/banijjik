import { SMS_PROVIDER, SMS_SOURCE } from "@banijjik/contracts/sms";
import { describe, expect, it } from "vitest";
import type { SmsGatewayView } from "./sms-api";
import { buildSmsGatewayBody, providerFromSelectValue, smsFormStateOf } from "./sms-state";

const STORED_VIEW: SmsGatewayView = {
  enabled: true,
  activeProvider: SMS_PROVIDER.ADAREACH,
  adareach: { username: "akmi", senderId: "AKMI", hasPassword: true },
  bulksmsbd: null,
  version: 4,
  updatedAt: "2026-10-26T04:00:00.000Z",
  source: SMS_SOURCE.ORGANIZATION,
};

const NOTHING_SET_VIEW: SmsGatewayView = {
  enabled: false,
  activeProvider: null,
  adareach: null,
  bulksmsbd: null,
  version: 0,
  updatedAt: "2026-10-26T04:00:00.000Z",
  source: SMS_SOURCE.NONE,
};

describe("the SMS settings form state", () => {
  it("never fills a secret box from the stored view, so a saved password is not shown again", () => {
    const state = smsFormStateOf(STORED_VIEW);

    expect(state.adareachPassword).toBe("");
    expect(state.adareachUsername).toBe("akmi");
  });

  it("keeps the stored password when the password box is left empty", () => {
    const body = buildSmsGatewayBody(smsFormStateOf(STORED_VIEW), STORED_VIEW);

    expect(body.adareach).toEqual({ username: "akmi", senderId: "AKMI" });
    expect(body.adareach).not.toHaveProperty("password");
  });

  it("sends a new password only when the person typed one", () => {
    const state = { ...smsFormStateOf(STORED_VIEW), adareachPassword: "new-secret" };

    const body = buildSmsGatewayBody(state, STORED_VIEW);

    expect(body.adareach).toEqual({ username: "akmi", senderId: "AKMI", password: "new-secret" });
  });

  it("sends the version the page was drawn from", () => {
    const body = buildSmsGatewayBody(smsFormStateOf(STORED_VIEW), STORED_VIEW);

    expect(body.version).toBe(4);
  });

  it("omits a provider part that was never set and left empty", () => {
    const body = buildSmsGatewayBody(smsFormStateOf(NOTHING_SET_VIEW), NOTHING_SET_VIEW);

    expect(body.adareach).toBeUndefined();
    expect(body.bulksmsbd).toBeUndefined();
    expect(body.activeProvider).toBeNull();
  });

  it("maps the provider select value to a provider, and an empty value to none", () => {
    expect(providerFromSelectValue(SMS_PROVIDER.BULKSMSBD)).toBe(SMS_PROVIDER.BULKSMSBD);
    expect(providerFromSelectValue(SMS_PROVIDER.ADAREACH)).toBe(SMS_PROVIDER.ADAREACH);
    expect(providerFromSelectValue("")).toBeNull();
  });
});

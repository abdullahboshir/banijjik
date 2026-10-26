import { CONTACT_EVENT_TYPE, CUSTOMER_OTP_PURPOSE } from "@banijjik/contracts/contact";
import { asId, type OtpChallengeId } from "@banijjik/ids";
import { describe, expect, it, vi } from "vitest";
import { sealOtpCode } from "./customer-otp-codec.js";
import { buildSendCustomerOtpSmsHandler } from "./send-customer-otp-sms.handler.js";
import type { OtpChallengeRepository } from "./ports/customer-account-ports.js";

const OTP_SECRET = "test-only-otp-secret-0123456789abcdef012345";
const CHALLENGE_ID = asId<OtpChallengeId>("019a0000-0000-7000-8000-000000000009");
const challenge = {
  otpChallengeId: CHALLENGE_ID,
  phoneE164: "+8801712345678",
  codeHash: "hash",
  codeCiphertext: sealOtpCode(OTP_SECRET, "012345"),
  attempts: 0,
  expiresAt: new Date("2026-10-26T00:00:00Z"),
  consumedAt: undefined,
  purpose: CUSTOMER_OTP_PURPOSE.SIGN_IN,
};
const envelope = {
  eventId: "019a0000-0000-7000-8000-000000000010",
  type: CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED,
  version: 1,
  occurredAt: "2026-10-26T00:00:00.000Z",
  organizationId: "019a0000-0000-7000-8000-000000000001",
  actorUserId: null,
  payload: { otpChallengeId: CHALLENGE_ID },
};

function challengeRepository() {
  const clearCode = vi.fn(async () => undefined);
  const challenges = {
    findById: vi.fn(async () => challenge),
    clearCode,
  } as unknown as OtpChallengeRepository;
  return { challenges, clearCode };
}

describe("customer OTP SMS event", () => {
  it("sends the sign-in code through the required purpose and clears it after a resolved refusal", async () => {
    const repository = challengeRepository();
    const send = vi.fn(async () => undefined);
    const handler = buildSendCustomerOtpSmsHandler({
      challenges: repository.challenges,
      sender: { send },
      composer: { compose: async (code) => `Your code: ${code}` },
      otpSecret: OTP_SECRET,
    });
    await handler.handle(envelope);
    expect(send).toHaveBeenCalledWith({
      phoneE164: challenge.phoneE164,
      text: "Your code: 012345",
      purpose: "CUSTOMER_OTP",
    });
    expect(repository.clearCode).toHaveBeenCalledWith(CHALLENGE_ID);
  });

  it("leaves the sealed code when the provider has a transient failure so the event can retry", async () => {
    const repository = challengeRepository();
    const handler = buildSendCustomerOtpSmsHandler({
      challenges: repository.challenges,
      sender: {
        send: async () => {
          throw new Error("temporary provider failure");
        },
      },
      composer: { compose: async () => "Your sign-in code" },
      otpSecret: OTP_SECRET,
    });
    await expect(handler.handle(envelope)).rejects.toThrow("temporary provider failure");
    expect(repository.clearCode).not.toHaveBeenCalled();
  });
});

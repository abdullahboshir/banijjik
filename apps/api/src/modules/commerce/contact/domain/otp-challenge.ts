import { CUSTOMER_OTP_RULES } from "@banijjik/contracts/contact";
import type { OtpChallengeId } from "@banijjik/ids";

/** One code sent to one phone. Only hashes and a sealed copy of the code are ever stored (ADR-119). */
export interface OtpChallenge {
  readonly otpChallengeId: OtpChallengeId;
  readonly phoneE164: string;
  readonly codeHash: string;
  /** The code sealed for the SMS handler; removed right after the message is sent. */
  readonly codeCiphertext: string | undefined;
  readonly attempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | undefined;
}

/** A challenge accepts a guess while it is unused, unexpired and has attempts left. */
export function canTakeGuess(challenge: OtpChallenge, now: Date): boolean {
  return (
    challenge.consumedAt === undefined &&
    challenge.expiresAt.getTime() > now.getTime() &&
    challenge.attempts < CUSTOMER_OTP_RULES.maxWrongAttempts
  );
}

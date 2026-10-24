import { CUSTOMER_OTP_PURPOSE, type CustomerOtpPurpose } from "@banijjik/contracts/contact";
import { asId, type OtpChallengeId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  stripMongoInternals,
} from "../../../../kernel/db/index.js";
import type { OtpChallengeRepository } from "../application/ports/customer-account-ports.js";
import type { OtpChallenge } from "../domain/otp-challenge.js";
import { OTP_CHALLENGE_MODEL_NAME, type OtpChallengeDocument } from "./customer-account.schema.js";

function toChallenge(document: OtpChallengeDocument): OtpChallenge {
  const stored = stripMongoInternals(document);
  return {
    otpChallengeId: asId<OtpChallengeId>(stored.otpChallengeId),
    phoneE164: stored.phoneE164,
    codeHash: stored.codeHash,
    codeCiphertext: stored.codeCiphertext,
    attempts: stored.attempts,
    expiresAt: stored.expiresAt,
    consumedAt: stored.consumedAt,
    purpose: (stored.purpose as CustomerOtpPurpose) ?? CUSTOMER_OTP_PURPOSE.SIGN_IN,
  };
}

export class MongoOtpChallengeRepository implements OtpChallengeRepository {
  async replaceForPhone(challenge: OtpChallenge): Promise<void> {
    const session = sessionOption(getActiveSession());
    await this.model().deleteMany({ phoneE164: challenge.phoneE164 }, session);
    await this.model().create(
      [
        {
          otpChallengeId: challenge.otpChallengeId,
          phoneE164: challenge.phoneE164,
          codeHash: challenge.codeHash,
          ...(challenge.codeCiphertext === undefined
            ? {}
            : { codeCiphertext: challenge.codeCiphertext }),
          attempts: challenge.attempts,
          expiresAt: challenge.expiresAt,
          purpose: challenge.purpose ?? CUSTOMER_OTP_PURPOSE.SIGN_IN,
        },
      ],
      session,
    );
  }

  async reserveGuess(input: {
    readonly phoneE164: string;
    readonly now: Date;
    readonly maxAttempts: number;
  }): Promise<OtpChallenge | undefined> {
    // One atomic update: the guess is counted in the same step that checks the limit.
    const document = await this.model()
      .findOneAndUpdate(
        {
          phoneE164: input.phoneE164,
          consumedAt: { $exists: false },
          expiresAt: { $gt: input.now },
          attempts: { $lt: input.maxAttempts },
        },
        { $inc: { attempts: 1 } },
        { returnDocument: "after", ...sessionOption(getActiveSession()) },
      )
      .lean<OtpChallengeDocument>();
    return document === null ? undefined : toChallenge(document);
  }

  async reserveGuessById(input: {
    readonly otpChallengeId: string;
    readonly phoneE164: string;
    readonly purpose: CustomerOtpPurpose;
    readonly now: Date;
    readonly maxAttempts: number;
  }): Promise<OtpChallenge | undefined> {
    const document = await this.model()
      .findOneAndUpdate(
        {
          otpChallengeId: input.otpChallengeId,
          phoneE164: input.phoneE164,
          purpose: input.purpose,
          consumedAt: { $exists: false },
          expiresAt: { $gt: input.now },
          attempts: { $lt: input.maxAttempts },
        },
        { $inc: { attempts: 1 } },
        { returnDocument: "after", ...sessionOption(getActiveSession()) },
      )
      .lean<OtpChallengeDocument>();
    return document === null ? undefined : toChallenge(document);
  }

  async consume(otpChallengeId: string, now: Date): Promise<boolean> {
    const result = await this.model().updateOne(
      { otpChallengeId, consumedAt: { $exists: false } },
      { $set: { consumedAt: now } },
      sessionOption(getActiveSession()),
    );
    return result.modifiedCount === 1;
  }

  async findById(otpChallengeId: string): Promise<OtpChallenge | undefined> {
    const document = await this.model()
      .findOne({ otpChallengeId }, null, sessionOption(getActiveSession()))
      .lean<OtpChallengeDocument>();
    return document === null ? undefined : toChallenge(document);
  }

  async clearCode(otpChallengeId: string): Promise<void> {
    await this.model().updateOne(
      { otpChallengeId },
      { $unset: { codeCiphertext: 1 } },
      sessionOption(getActiveSession()),
    );
  }

  private model() {
    return models({}).get<OtpChallengeDocument>(OTP_CHALLENGE_MODEL_NAME);
  }
}

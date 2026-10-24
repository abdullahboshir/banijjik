import type {
  CustomerDataExportParticipant,
  CustomerErasureParticipant,
} from "@banijjik/contracts/contact";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { RateLimiter } from "../../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { ContactRepository } from "./ports/contact-repository.js";
import type {
  CustomerAccessTokenIssuer,
  CustomerAccountRepository,
  CustomerSessionRepository,
  OtpChallengeRepository,
} from "./ports/customer-account-ports.js";
import type { EventPublisher } from "./ports/event-publisher.js";
import type { UnitOfWork } from "./ports/unit-of-work.js";

/** What the customer sign-in use cases need: the data, the transaction, the limits and the secret. */
export interface CustomerAuthDependencies {
  readonly contacts: ContactRepository;
  readonly accounts: CustomerAccountRepository;
  readonly sessions: CustomerSessionRepository;
  readonly challenges: OtpChallengeRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly limiter: RateLimiter;
  readonly tokens: CustomerAccessTokenIssuer;
  /** Seals and hashes one-time codes (`OTP_SECRET`). Never logged. */
  readonly otpSecret: string;
  readonly erasureParticipants: readonly CustomerErasureParticipant[];
  readonly exportParticipants: readonly CustomerDataExportParticipant[];
}

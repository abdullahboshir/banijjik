import { randomBytes } from "node:crypto";
import { ERROR_CODE } from "@banijjik/contracts";
import {
  GUEST_SESSION_SECRET_BYTES,
  WEBSITE_EVENT_TYPE,
  type CreateGuestSessionResult,
  type GuestSessionEntity,
} from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { computeGuestSessionExpiry } from "../../domain/guest-session.entity.js";
import { hashGuestSecret } from "./resolve-guest-session.use-case.js";
import type { GuestSessionRepository } from "../ports/guest-session-repository.port.js";

export interface GuestSessionEventPublisher {
  publish(eventType: string, payload: unknown): Promise<void>;
}

export interface CreateGuestSessionDependencies {
  readonly repository: GuestSessionRepository;
  readonly clock: Clock;
  readonly isGuestCheckoutEnabled?: (organizationId: string) => Promise<boolean>;
  readonly events?: GuestSessionEventPublisher;
}

export class CreateGuestSessionUseCase {
  constructor(private readonly dependencies: CreateGuestSessionDependencies) {}

  async execute(organizationId: string): Promise<CreateGuestSessionResult> {
    const isEnabled = this.dependencies.isGuestCheckoutEnabled;
    if (isEnabled && !(await isEnabled(organizationId))) {
      throw new AppError({
        code: ERROR_CODE.WEBSITE_GUEST_CHECKOUT_DISABLED,
        messageKey: "errors.guest_checkout_disabled",
      });
    }

    const now = this.dependencies.clock.now();
    const rawSecret = randomBytes(GUEST_SESSION_SECRET_BYTES).toString("hex");
    const secretHash = hashGuestSecret(rawSecret);
    const guestSessionId = newId();
    const expiresAt = computeGuestSessionExpiry(now);

    const entity: GuestSessionEntity = {
      guestSessionId,
      organizationId,
      secretHash,
      expiresAt,
      provisionalContactId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.dependencies.repository.create(entity);

    if (this.dependencies.events) {
      await this.dependencies.events.publish(WEBSITE_EVENT_TYPE.GUEST_SESSION_CREATED, {
        guestSessionId,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return {
      guestSessionId,
      rawSecret,
      expiresAt,
    };
  }
}

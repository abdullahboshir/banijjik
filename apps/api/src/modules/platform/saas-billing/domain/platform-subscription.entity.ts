import { SUBSCRIPTION_STATUS, TRIAL_DAYS, type SubscriptionStatus } from "@banijjik/contracts";
import { trialNotActive } from "./errors.js";
import {
  newId,
  type OrganizationId,
  type PackageId,
  type PlatformSubscriptionId,
} from "@banijjik/ids";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const INITIAL_VERSION = 1;

export interface PlatformSubscriptionProps {
  readonly platformSubscriptionId: PlatformSubscriptionId;
  readonly organizationId: OrganizationId;
  readonly basePackageId: PackageId;
  readonly addOnPackageIds: readonly PackageId[];
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface StartTrialInput {
  readonly organizationId: OrganizationId;
  readonly basePackageId: PackageId;
  readonly now: Date;
}

/**
 * What an organization bought (09 section 4.6). There is at most one open (not cancelled)
 * subscription per organization. Card 1.6a only starts the trial; billing arrives with card 6.2.
 */
export class PlatformSubscription implements PlatformSubscriptionProps {
  readonly platformSubscriptionId: PlatformSubscriptionId;
  readonly organizationId: OrganizationId;
  readonly basePackageId: PackageId;
  readonly addOnPackageIds: readonly PackageId[];
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: PlatformSubscriptionProps) {
    this.platformSubscriptionId = props.platformSubscriptionId;
    this.organizationId = props.organizationId;
    this.basePackageId = props.basePackageId;
    this.addOnPackageIds = props.addOnPackageIds;
    this.status = props.status;
    this.trialEndsAt = props.trialEndsAt;
    this.currentPeriodStart = props.currentPeriodStart;
    this.currentPeriodEnd = props.currentPeriodEnd;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** A new organization starts on a 14-day trial of the BUNDLE package (owner decision). */
  static startTrial(input: StartTrialInput): PlatformSubscription {
    return new PlatformSubscription({
      platformSubscriptionId: newId<PlatformSubscriptionId>(),
      organizationId: input.organizationId,
      basePackageId: input.basePackageId,
      addOnPackageIds: [],
      status: SUBSCRIPTION_STATUS.TRIALING,
      trialEndsAt: new Date(input.now.getTime() + TRIAL_DAYS * MILLISECONDS_PER_DAY),
      currentPeriodStart: null,
      currentPeriodEnd: null,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /**
   * Adds days to the trial, counted from the later of the current end and now, so a trial that
   * already ended gets `days` full days from today. Only a trial can be extended.
   */
  withTrialExtended(days: number, now: Date): PlatformSubscription {
    if (this.status !== SUBSCRIPTION_STATUS.TRIALING || this.trialEndsAt === null) {
      throw trialNotActive();
    }
    const startMilliseconds = Math.max(this.trialEndsAt.getTime(), now.getTime());
    const trialEndsAt = new Date(startMilliseconds + days * MILLISECONDS_PER_DAY);
    return new PlatformSubscription({ ...this, trialEndsAt });
  }

  /** The same subscription on other packages; the status and the dates stay. */
  withPackages(
    basePackageId: PackageId,
    addOnPackageIds: readonly PackageId[],
  ): PlatformSubscription {
    return new PlatformSubscription({ ...this, basePackageId, addOnPackageIds });
  }

  /** Rebuilds a stored subscription. */
  static restore(props: PlatformSubscriptionProps): PlatformSubscription {
    return new PlatformSubscription(props);
  }
}

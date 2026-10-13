import { PLATFORM_AUDIT_ACTION, SYSTEM_REASON } from "@banijjik/contracts";
import { asId, type PackageId, type UserId } from "@banijjik/ids";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import { packageKindMismatch } from "../../domain/errors.js";
import { SubscriptionSupport } from "./subscription-support.js";
import type { SubscriptionDetail } from "./subscription-detail.js";

export interface ChangePackageInput {
  readonly actorUserId: UserId;
  readonly organizationId: string;
  readonly basePackageId: string;
  readonly addOnPackageIds: readonly string[];
}

/** Moves a subscription to another base package and add-ons; the status stays. Payment is card 6.2. */
export class ChangePackageUseCase extends SubscriptionSupport {
  execute(input: ChangePackageInput): Promise<SubscriptionDetail> {
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const before = await this.requireOpen(input.organizationId);
      await this.assertKinds(input);
      const changed = before.withPackages(
        asId<PackageId>(input.basePackageId),
        input.addOnPackageIds.map((packageId) => asId<PackageId>(packageId)),
      );
      const saved = await this.save({
        updated: changed,
        before,
        actorUserId: input.actorUserId,
        guard: () => this.touchPackages(input),
        audit: {
          action: PLATFORM_AUDIT_ACTION.SUBSCRIPTION_PACKAGE_CHANGED,
          changes: {
            basePackageId: { from: before.basePackageId, to: changed.basePackageId },
            addOnPackageIds: { from: before.addOnPackageIds, to: changed.addOnPackageIds },
          },
        },
      });
      return this.detailOf(saved);
    });
  }

  /**
   * Writes every named package inside the transaction (guard counter), so a concurrent archive of
   * one of them conflicts and the retry sees it archived (ADR-093). A package that is no longer
   * ACTIVE is the same error as any other unusable package.
   */
  private async touchPackages(input: ChangePackageInput): Promise<void> {
    const distinct = [...new Set([input.basePackageId, ...input.addOnPackageIds])];
    const matched = await this.dependencies.packages.touchActive(distinct);
    if (matched < distinct.length) throw packageKindMismatch();
  }

  /** The base must be an ACTIVE base package and each add-on an ACTIVE add-on. */
  private async assertKinds(input: ChangePackageInput): Promise<void> {
    const ids = [input.basePackageId, ...input.addOnPackageIds];
    const found = await this.dependencies.packages.findByIds(ids);
    const isUsable = (packageId: string, isAddOn: boolean): boolean =>
      found.some(
        (entry) => entry.packageId === packageId && entry.isAddOn === isAddOn && entry.isActive,
      );
    const isValid =
      isUsable(input.basePackageId, false) &&
      input.addOnPackageIds.every((packageId) => isUsable(packageId, true));
    if (!isValid) throw packageKindMismatch();
  }
}

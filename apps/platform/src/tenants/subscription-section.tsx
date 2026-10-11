import type { PlatformPackageResponse, PlatformSubscriptionResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import type { ReactElement } from "react";
import { formatDate } from "../lib/format";
import { subscriptionTone } from "../lib/status-tones";
import { StatusPill } from "../shell/status-pill";
import { packageDisplayName } from "../packages/package-name";

interface SubscriptionSectionProps {
  subscription: PlatformSubscriptionResponse | null;
  /** Active packages, to turn package keys into names; an operator without package access sees keys. */
  packages: PlatformPackageResponse[];
  translator: Translator;
}

function nameOfKey(
  packageKey: string,
  packages: PlatformPackageResponse[],
  translator: Translator,
): string {
  const known = packages.find((pkg) => pkg.packageKey === packageKey);
  return known ? packageDisplayName(known, translator) : packageKey;
}

function Fact({ term, children }: { term: string; children: ReactElement | string }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-secondary">{term}</dt>
      <dd className="text-body text-primary">{children}</dd>
    </div>
  );
}

/** The subscription of a tenant: status, package, add-ons and the end of the trial. */
export function SubscriptionSection({
  subscription,
  packages,
  translator,
}: SubscriptionSectionProps): ReactElement {
  const { t, locale } = translator;
  return (
    <section className="rounded-md border border-default bg-surface p-4">
      <h2 className="mb-3 text-title font-semibold text-primary">
        {t("platform.subscription.title")}
      </h2>
      {subscription ? (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact term={t("platform.subscription.status")}>
            <StatusPill
              tone={subscriptionTone(subscription.status)}
              label={t(`platform.status.subscription.${subscription.status}`)}
            />
          </Fact>
          <Fact term={t("platform.subscription.package")}>
            {nameOfKey(subscription.basePackageKey, packages, translator)}
          </Fact>
          <Fact term={t("platform.subscription.trialEnds")}>
            {subscription.trialEndsAt
              ? formatDate(subscription.trialEndsAt, locale)
              : t("platform.subscription.noTrial")}
          </Fact>
          <Fact term={t("platform.subscription.addOns")}>
            {subscription.addOnPackageKeys.length > 0
              ? subscription.addOnPackageKeys
                  .map((packageKey) => nameOfKey(packageKey, packages, translator))
                  .join(", ")
              : t("platform.subscription.noAddOns")}
          </Fact>
        </dl>
      ) : (
        <p className="text-body text-secondary">{t("platform.subscription.none")}</p>
      )}
    </section>
  );
}

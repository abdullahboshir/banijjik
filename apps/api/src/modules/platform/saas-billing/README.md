# platform/saas-billing: what an organization bought

The subscription of an organization and the access mode it implies (10-MODULE-CATALOG section 8, ADR-053).

- **Entity:** `PlatformSubscription` (platform database, tenancy ORGANIZATION, versioned): `basePackageId`, `addOnPackageIds`, `status` (TRIALING, ACTIVE, PAST_DUE, CANCELLED), `trialEndsAt`, `currentPeriodStart/End`. A unique partial index allows one open (not cancelled) subscription per organization.
- **Trial:** `StartTrialUseCase` gives a new organization 14 days of BUNDLE. `core/organization` calls it through its `TrialStarter` port inside the create transaction; without a seeded BUNDLE package the business is not created. It does not bump `Organization.configVersion` (the organization is created in the same transaction at version 1, so nothing can be cached yet). Any later writer of a subscription must bump it through the `ConfigVersionBumper` port.
- **Access mode:** `accessModeOf(subscription, now)` is a pure function of the status and the dates. TRIALING before `trialEndsAt` is FULL; after it the subscription counts as PAST_DUE since that day. PAST_DUE is FULL with a banner for 7 days, then READ_ONLY. CANCELLED or no subscription is READ_ONLY. No job flips a status for the mode to be right.
- **Public API** (`index.ts`): `registerSaasBillingModels`, `saasBillingManifest`, `buildTrialStarter`, `buildSubscriptionReader`, `accessModeOf`.
- **Not here:** invoices, payment collection and status changes (card 6.2), platform endpoints (card 1.8).

import {
  EXPENSE_REQUIRE_ATTACHMENT_ABOVE_DEFAULT,
  EXPENSE_REQUIRE_ATTACHMENT_ABOVE_SETTING_KEY,
  type Money,
} from "@banijjik/contracts/accounting";
import type { ModuleManifest } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildExpenseRouter } from "../modules/commerce/expense/index.js";
import { buildFileReferenceReader } from "../modules/core/file/index.js";
import {
  buildLocationLookup,
  buildOrganizationCurrencyReader,
} from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";

export interface ExpenseRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

/** Expense CRUD API, mounted on the tenant pipeline (card 3.8c). */
export function buildExpenseTenantRouter(input: ExpenseRouterInput): Router {
  const locations = buildLocationLookup();
  const files = buildFileReferenceReader();
  const currencies = buildOrganizationCurrencyReader();
  const settings = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return buildExpenseRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    locations: { isActiveLocation: (locationId) => locations.isActiveLocation(locationId) },
    attachments: files,
    attachmentThreshold: {
      async read(organizationId: OrganizationId): Promise<Money> {
        const [resolved, currency] = await Promise.all([
          settings.resolve(organizationId, {
            keys: [EXPENSE_REQUIRE_ATTACHMENT_ABOVE_SETTING_KEY],
          }),
          currencies.read(organizationId),
        ]);
        const value = resolved.get(EXPENSE_REQUIRE_ATTACHMENT_ABOVE_SETTING_KEY)?.value;
        const amount =
          typeof value === "number" ? value : EXPENSE_REQUIRE_ATTACHMENT_ABOVE_DEFAULT.amount;
        return {
          amount,
          currency: (currency ??
            EXPENSE_REQUIRE_ATTACHMENT_ABOVE_DEFAULT.currency) as Money["currency"],
        };
      },
    },
  });
}

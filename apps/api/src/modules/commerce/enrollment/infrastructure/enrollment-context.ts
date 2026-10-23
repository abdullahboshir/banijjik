import { buildLocationLookup } from "../../../core/organization/index.js";
import { CUSTOM_FIELD_AUDIENCE } from "@banijjik/validation";
import {
  VALIDATION_MESSAGE_KEYS,
  VALIDATION_FALLBACK_MESSAGE_KEY,
  DomainRuleError,
  ERROR_CODE,
  OFFERING_KIND,
} from "@banijjik/contracts";
import { OFFERING_STATUS, type PlanDetails } from "@banijjik/contracts/catalog";
import {
  ENROLLMENT_RULE_KEY,
  ENROLLMENT_SETTING,
  ENROLLMENT_REFUND_POLICY,
} from "@banijjik/contracts/enrollment";
import {
  asId,
  type ContactId,
  type OfferingId,
  type LocationId,
  type OrganizationId,
} from "@banijjik/ids";
import { buildCustomFieldValuesSchema, CUSTOM_FIELD_VALUE_MODE } from "@banijjik/validation";
import type { EnrollmentCreateBody } from "@banijjik/validation/enrollment";
import { models } from "../../../../kernel/db/index.js";
import { buildContactBillToReader } from "../../contact/index.js";
import {
  MongoOfferingRepository,
  MongoOfferingLocationRepository,
  isActiveVariant,
} from "../../catalog/index.js";
import { buildConfirmedBookingReader, businessDateOf } from "../../booking/index.js";
import { buildEffectiveCustomFieldReader } from "../../../core/custom-field/index.js";
import { buildSettingsResolver } from "../../../core/settings/index.js";
import type { EnrollmentContext } from "../application/ports.js";
import type { ModuleManifest } from "@banijjik/contracts";
import type { OrgConfigService } from "../../../platform/entitlement/index.js";
import type { Money } from "@banijjik/contracts/catalog";

export interface EnrollmentContextInput {
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly fee: (
    organizationId: string,
    body: Pick<EnrollmentCreateBody, "offeringId" | "variantId" | "locationId">,
  ) => Promise<Money>;
}
function invalid(messageKey: string): never {
  throw new DomainRuleError({ code: ERROR_CODE.VALIDATION_ERROR, messageKey });
}
async function timezone(organizationId: string): Promise<string> {
  const row = await models({})
    .get<{ timezone: string }>("Organization")
    .findOne({ organizationId }, { _id: 0, timezone: 1 })
    .lean();
  if (row === null) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
  return row.timezone;
}
async function readPlan(
  body: Pick<EnrollmentCreateBody, "offeringId" | "variantId" | "locationId">,
): Promise<PlanDetails> {
  if (!(await buildLocationLookup().isActiveLocation(body.locationId)))
    invalid(ENROLLMENT_RULE_KEY.PLAN);
  const offeringId = asId<OfferingId>(body.offeringId);
  const offering = await new MongoOfferingRepository().findById(offeringId);
  if (
    offering === undefined ||
    offering.kind !== OFFERING_KIND.PLAN ||
    offering.status !== OFFERING_STATUS.ACTIVE
  )
    invalid(ENROLLMENT_RULE_KEY.PLAN);
  const variant = offering.variants.find((row) => row.variantId === body.variantId);
  if (variant === undefined || !isActiveVariant(variant)) invalid(ENROLLMENT_RULE_KEY.PLAN);
  const locations = await new MongoOfferingLocationRepository().forLocation(
    [offeringId],
    asId<LocationId>(body.locationId),
  );
  if (
    locations.some(
      (row) =>
        (row.variantId === undefined || row.variantId === body.variantId) &&
        row.isAvailable === false,
    )
  )
    invalid(ENROLLMENT_RULE_KEY.PLAN);
  // Safe: catalog validates kindDetails against the PLAN discriminant before storing it.
  const plan = offering.kindDetails as PlanDetails;
  return { ...plan, ...variant.overrides };
}
export function buildEnrollmentContext(input: EnrollmentContextInput): EnrollmentContext {
  const contacts = buildContactBillToReader();
  const bookings = buildConfirmedBookingReader();
  const fields = buildEffectiveCustomFieldReader();
  const settings = buildSettingsResolver(input);
  return {
    canRenew: async (body) => {
      try {
        await readPlan(body);
        return true;
      } catch (error) {
        if (error instanceof DomainRuleError && error.messageKey === ENROLLMENT_RULE_KEY.PLAN)
          return false;
        throw error;
      }
    },
    today: async (organizationId, now) => businessDateOf(now, await timezone(organizationId)),
    plan: readPlan,
    fee: input.fee,
    activeContact: async (contactId) =>
      (await contacts.findActive(asId<ContactId>(contactId))) !== undefined,
    async payer(organizationId, contactId, explicit) {
      if (explicit !== undefined) {
        const payer = await contacts.findActive(asId<ContactId>(explicit));
        if (payer === undefined) invalid(ENROLLMENT_RULE_KEY.CONTACT);
        return payer.contactId;
      }
      const definitions = await fields.forEntity(asId<OrganizationId>(organizationId), "contact");
      const link = definitions.find((field) => field.link?.defaultBillTo === true);
      if (link === undefined) return contactId;
      return (await contacts.readLinkValue(asId<ContactId>(contactId), link.fieldKey)) ?? contactId;
    },
    async fields(organizationId, values) {
      const definitions = await fields.forEntity(
        asId<OrganizationId>(organizationId),
        "enrollment",
      );
      const parsed = buildCustomFieldValuesSchema(definitions, {
        audience: CUSTOM_FIELD_AUDIENCE.ADMIN,
        mode: CUSTOM_FIELD_VALUE_MODE.CREATE,
      }).safeParse(values);
      if (!parsed.success) throw customFieldFailure(parsed.error.issues);
      // Safe: the field schema accepts only a strict record of effective field values.
      return parsed.data as Readonly<Record<string, unknown>>;
    },
    settings: async (organizationId) => readSettings(settings, organizationId),
    bookingForToday: ({ today, ...payload }) =>
      bookings.findForCheckIn({ ...payload, businessDate: today }),
  };
}
async function readSettings(
  resolver: ReturnType<typeof buildSettingsResolver>,
  organizationId: string,
) {
  const resolved = await resolver.resolve(asId<OrganizationId>(organizationId), {
    keys: Object.values(ENROLLMENT_SETTING),
  });
  const value = (key: string) => resolved.get(key)?.value;
  const number = (key: string, fallback: number) =>
    typeof value(key) === "number" ? Number(value(key)) : fallback;
  const refundPolicy = value(ENROLLMENT_SETTING.REFUND_POLICY);
  return {
    graceDays: number(ENROLLMENT_SETTING.GRACE_DAYS, 5),
    reminderDays: number(ENROLLMENT_SETTING.REMINDER_DAYS, 3),
    requirePayment: value(ENROLLMENT_SETTING.REQUIRE_PAYMENT) !== false,
    blockOverdue: value(ENROLLMENT_SETTING.BLOCK_OVERDUE) !== false,
    lockPrice: value(ENROLLMENT_SETTING.LOCK_PRICE) === true,
    refundPolicy:
      typeof refundPolicy === "string" &&
      Object.values(ENROLLMENT_REFUND_POLICY).includes(refundPolicy as "NONE")
        ? refundPolicy
        : ENROLLMENT_REFUND_POLICY.NONE,
  };
}
function customFieldFailure(
  issues: readonly { path: readonly PropertyKey[]; code: string; message?: string }[],
): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.VALIDATION_ERROR,
    details: {
      fields: issues.map((issue) => {
        const key =
          issue.message !== undefined && VALIDATION_MESSAGE_KEYS.includes(issue.message)
            ? issue.message
            : "validation." + issue.code;
        return {
          path: ["customFields", ...issue.path.map(String)].join("."),
          messageKey: VALIDATION_MESSAGE_KEYS.includes(key) ? key : VALIDATION_FALLBACK_MESSAGE_KEY,
        };
      }),
    },
  });
}

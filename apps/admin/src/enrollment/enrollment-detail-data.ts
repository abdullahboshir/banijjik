import "server-only";
import {
  PERMISSION_KEY,
  type CurrencyCode,
  type LocationResponse,
  type SettingsResponse,
} from "@banijjik/contracts";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { EnrollmentDetailResponse } from "@banijjik/contracts/enrollment";
import {
  PAYMENT_METHODS_DEFAULT,
  PAYMENT_METHODS_SETTING_KEY,
  PAYMENT_REQUEST_TYPE,
  type DueItemResponse,
  type PaymentMethod,
} from "@banijjik/contracts/payment";
import { loadCurrency } from "../catalog/catalog-lookups";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { loadContactNames } from "./enrollment-lookups";

/** `GET /dues` has no request filter: the page is narrowed by payer, type and location at the API maximum. */
const DUES_PAGE_LIMIT = 100;
const LOCATION_LIMIT = 100;

function allowedMethodsOf(settings: SettingsResponse | undefined): readonly PaymentMethod[] {
  const value = settings?.settings[PAYMENT_METHODS_SETTING_KEY]?.value;
  if (Array.isArray(value) && value.length > 0) return value as readonly PaymentMethod[];
  return PAYMENT_METHODS_DEFAULT;
}

export interface EnrollmentDetailData {
  readonly enrollment: EnrollmentDetailResponse;
  readonly planName: string | undefined;
  readonly variantName: string | undefined;
  readonly contactNames: ReadonlyMap<string, string>;
  readonly locationName: string;
  readonly currency: CurrencyCode;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly dueMinorByPeriodId: Readonly<Record<string, number>>;
  readonly canReceive: boolean;
  readonly canRefund: boolean;
}

export async function loadEnrollmentDetail(
  access: OrgAccess,
  enrollmentId: string,
): Promise<EnrollmentDetailData> {
  const organizationId = access.organization.organizationId;
  const { data: enrollment } = await fetchBusinessResource<EnrollmentDetailResponse>(
    `/orgs/${organizationId}/enrollments/${enrollmentId}`,
  );
  const [currency, settings, dues, locations, offering, contactNames] = await Promise.all([
    loadCurrency(access),
    fetchBusinessResourceIfAllowed<SettingsResponse>(
      `/orgs/${organizationId}/settings?keys=${PAYMENT_METHODS_SETTING_KEY}`,
    ),
    fetchBusinessResourceIfAllowed<DueItemResponse[]>(
      `/orgs/${organizationId}/dues?contactId=${enrollment.billToContactId}&requestType=${PAYMENT_REQUEST_TYPE.ENROLLMENT}&locationId=${enrollment.locationId}&limit=${DUES_PAGE_LIMIT}`,
    ),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOCATION_LIMIT}`,
    ),
    fetchBusinessResourceIfAllowed<OfferingResponse>(
      `/orgs/${organizationId}/offerings/${enrollment.offeringId}`,
    ),
    loadContactNames(access, [enrollment.contactId, enrollment.billToContactId]),
  ]);
  return {
    enrollment,
    planName: offering?.name,
    variantName: offering?.variants.find((v) => v.variantId === enrollment.variantId)?.name,
    contactNames,
    locationName:
      locations?.find((location) => location.locationId === enrollment.locationId)?.name ??
      enrollment.locationId,
    currency,
    allowedMethods: allowedMethodsOf(settings),
    dueMinorByPeriodId: Object.fromEntries(
      (dues ?? []).map((due) => [due.requestId, due.due.amount]),
    ),
    canReceive:
      access.canWrite &&
      holdsPermission(access.config.permissions, PERMISSION_KEY.PAYMENT_PAYMENT_RECEIVE),
    canRefund:
      access.canWrite &&
      holdsPermission(access.config.permissions, PERMISSION_KEY.PAYMENT_PAYMENT_REFUND),
  };
}

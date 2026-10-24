import { ENROLLMENT_EVENT_TYPE } from "../enrollment/index.js";
import { ACCOUNTING_EVENT_TYPE, EXPENSE_EVENT_TYPE } from "../accounting/accounting-event-type.js";
import { BOOKING_EVENT_TYPE } from "../booking/booking-event-type.js";
import { CATALOG_EVENT_TYPE } from "../catalog/catalog-event-type.js";
import { INVENTORY_EVENT_TYPE } from "../inventory/inventory-event-type.js";
import { CONTACT_EVENT_TYPE } from "../contact/contact-event-type.js";
import { COMMISSION_EVENT_TYPE } from "../commission/commission-event-type.js";
import { CREDIT_EVENT_TYPE } from "../credit/credit-event-type.js";
import { CUSTOM_FIELD_EVENT_TYPE } from "../custom-field/custom-field-event-type.js";
import { DIRECTORY_EVENT_TYPE } from "../directory/directory-event-type.js";
import { IAM_EVENT_TYPE } from "../iam/iam-event-type.js";
import { ORGANIZATION_EVENT_TYPE } from "../organization/organization-event-type.js";
import { PAYMENT_EVENT_TYPE } from "../payment/payment-event-type.js";
import { PRICING_EVENT_TYPE } from "../pricing/pricing-event-type.js";
import { SALES_EVENT_TYPE } from "../sales/sales-event-type.js";
import { SETTINGS_EVENT_TYPE } from "../settings/settings-event-type.js";
import { WEBSITE_EVENT_TYPE } from "../website/website-event-type.js";

/** Every domain event type. A module adds its own constant object here when it starts to emit (card 1.5b). */
export const EVENT_TYPE = Object.freeze({
  ...ENROLLMENT_EVENT_TYPE,
  ...IAM_EVENT_TYPE,
  ...ORGANIZATION_EVENT_TYPE,
  ...CUSTOM_FIELD_EVENT_TYPE,
  ...SETTINGS_EVENT_TYPE,
  ...CONTACT_EVENT_TYPE,
  ...CATALOG_EVENT_TYPE,
  ...ACCOUNTING_EVENT_TYPE,
  ...EXPENSE_EVENT_TYPE,
  ...PAYMENT_EVENT_TYPE,
  ...BOOKING_EVENT_TYPE,
  ...PRICING_EVENT_TYPE,
  ...INVENTORY_EVENT_TYPE,
  ...DIRECTORY_EVENT_TYPE,
  ...CREDIT_EVENT_TYPE,
  ...COMMISSION_EVENT_TYPE,
  ...SALES_EVENT_TYPE,
  ...WEBSITE_EVENT_TYPE,
} as const);

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

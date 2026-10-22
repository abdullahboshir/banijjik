import { ENROLLMENT_EVENT_TYPE } from "../enrollment/index.js";
import { describe, expect, it } from "vitest";
import { ACCOUNTING_EVENT_TYPE, EXPENSE_EVENT_TYPE } from "../accounting/accounting-event-type.js";
import { BOOKING_EVENT_TYPE } from "../booking/booking-event-type.js";
import { CATALOG_EVENT_TYPE } from "../catalog/catalog-event-type.js";
import { CONTACT_EVENT_TYPE } from "../contact/contact-event-type.js";
import { COMMISSION_EVENT_TYPE } from "../commission/commission-event-type.js";
import { CREDIT_EVENT_TYPE } from "../credit/credit-event-type.js";
import { CUSTOM_FIELD_EVENT_TYPE } from "../custom-field/custom-field-event-type.js";
import { DIRECTORY_EVENT_TYPE } from "../directory/directory-event-type.js";
import { IAM_EVENT_TYPE } from "../iam/iam-event-type.js";
import { INVENTORY_EVENT_TYPE } from "../inventory/inventory-event-type.js";
import { ORGANIZATION_EVENT_TYPE } from "../organization/organization-event-type.js";
import { PAYMENT_EVENT_TYPE } from "../payment/payment-event-type.js";
import { PRICING_EVENT_TYPE } from "../pricing/pricing-event-type.js";
import { SALES_EVENT_TYPE } from "../sales/sales-event-type.js";
import { SETTINGS_EVENT_TYPE } from "../settings/settings-event-type.js";
import { EVENT_TYPE } from "./event-type.js";
import { OUTBOX_STATUS } from "./outbox-status.js";

// The module segment is kebab-case, so `custom-field` is a legal event name (card 2.3).
const EVENT_NAME_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][A-Za-z]*\.[a-z][A-Za-z]*(ed|d)$/;

describe("event types", () => {
  it("contains every module event exactly once", () => {
    const expected = [
      ...Object.values(IAM_EVENT_TYPE),
      ...Object.values(ORGANIZATION_EVENT_TYPE),
      ...Object.values(CUSTOM_FIELD_EVENT_TYPE),
      ...Object.values(SETTINGS_EVENT_TYPE),
      ...Object.values(CONTACT_EVENT_TYPE),
      ...Object.values(CATALOG_EVENT_TYPE),
      ...Object.values(ACCOUNTING_EVENT_TYPE),
      ...Object.values(EXPENSE_EVENT_TYPE),
      ...Object.values(PAYMENT_EVENT_TYPE),
      ...Object.values(BOOKING_EVENT_TYPE),
      ...Object.values(PRICING_EVENT_TYPE),
      ...Object.values(INVENTORY_EVENT_TYPE),
      ...Object.values(DIRECTORY_EVENT_TYPE),
      ...Object.values(CREDIT_EVENT_TYPE),
      ...Object.values(COMMISSION_EVENT_TYPE),
      ...Object.values(SALES_EVENT_TYPE),
      ...Object.values(ENROLLMENT_EVENT_TYPE),
    ].sort();

    expect(Object.values(EVENT_TYPE).sort()).toEqual(expected);
    expect(new Set(Object.values(EVENT_TYPE)).size).toBe(expected.length);
  });

  it("names every event <module>.<entity>.<pastTenseVerb>", () => {
    for (const type of Object.values(EVENT_TYPE)) expect(type).toMatch(EVENT_NAME_PATTERN);
  });

  it("declares the three role events of 09 section 4.5 with archived instead of deleted", () => {
    expect(IAM_EVENT_TYPE.ROLE_CREATED).toBe("iam.role.created");
    expect(IAM_EVENT_TYPE.ROLE_PERMISSIONS_CHANGED).toBe("iam.role.permissionsChanged");
    expect(IAM_EVENT_TYPE.ROLE_ARCHIVED).toBe("iam.role.archived");
  });
});

describe("outbox status", () => {
  it("has the three states of an outbox event", () => {
    expect(Object.values(OUTBOX_STATUS)).toEqual(["PENDING", "DISPATCHED", "DEAD"]);
  });
});

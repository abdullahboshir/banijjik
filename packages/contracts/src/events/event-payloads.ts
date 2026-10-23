import {
  ENROLLMENT_EVENT_TYPE,
  type EnrollmentEventPayload,
  type CheckInEventPayload,
} from "../enrollment/index.js";
import { ACCOUNTING_EVENT_TYPE, EXPENSE_EVENT_TYPE } from "../accounting/accounting-event-type.js";
import {
  BOOKING_EVENT_TYPE,
  type BookingEventPayload,
  type BookingReminderPayload,
  type EventSessionEventPayload,
  type ResourceEventPayload,
} from "../booking/booking-event-type.js";
import type { OfferingEventPayload } from "../catalog/catalog-contracts.js";
import { CATALOG_EVENT_TYPE } from "../catalog/catalog-event-type.js";
import type { PromotionEventPayload } from "../pricing/pricing-contracts.js";
import { PRICING_EVENT_TYPE } from "../pricing/pricing-event-type.js";
import type {
  InventoryStockChangedPayload,
  InventoryStockLowPayload,
  InventoryTransferCompletedPayload,
} from "../inventory/inventory-contracts.js";
import { INVENTORY_EVENT_TYPE } from "../inventory/inventory-event-type.js";
import type {
  ContactEventPayload,
  CustomerAccountEventPayload,
  CustomerOtpRequestedPayload,
} from "../contact/contact-contracts.js";
import { CONTACT_EVENT_TYPE } from "../contact/contact-event-type.js";
import { CUSTOM_FIELD_EVENT_TYPE } from "../custom-field/custom-field-event-type.js";
import type { CustomFieldDefinitionChangedPayload } from "../custom-field/custom-field-contracts.js";
import type { ListingEventPayload } from "../directory/directory-contracts.js";
import type {
  ListingReportFiledPayload,
  ListingReportResolvedPayload,
} from "../directory/listing-report.js";
import { DIRECTORY_EVENT_TYPE } from "../directory/directory-event-type.js";
import {
  COMMISSION_EVENT_TYPE,
  type CommissionEntryRecordedPayload,
} from "../commission/commission-event-type.js";
import type {
  CreditEntryCreatedPayload,
  CreditPurchaseEventPayload,
  UnlockCreatedPayload,
} from "../credit/credit-contracts.js";
import { CREDIT_EVENT_TYPE } from "../credit/credit-event-type.js";
import { IAM_EVENT_TYPE } from "../iam/iam-event-type.js";
import { ORGANIZATION_EVENT_TYPE } from "../organization/organization-event-type.js";
import {
  PAYMENT_EVENT_TYPE,
  type PaymentEventPayload,
  type StoreCreditEventPayload,
} from "../payment/payment-event-type.js";
import { SETTINGS_EVENT_TYPE } from "../settings/settings-event-type.js";
import type {
  ModuleToggledPayload,
  SettingChangedPayload,
  TermChangedPayload,
} from "../settings/settings-contracts.js";
import type { OrderEventPayload } from "../sales/sales-event-type.js";
import { SALES_EVENT_TYPE } from "../sales/sales-event-type.js";

export interface JournalPostedPayload {
  readonly journalEntryId: string;
}

export interface ExpenseEventPayload {
  readonly expenseId: string;
}

/** Payloads carry identifiers only, never personal data: a consumer reads the rest through the owning module. */
export interface UserRegisteredPayload {
  readonly userId: string;
}

export interface RolePayload {
  readonly roleId: string;
}

export interface OrganizationCreatedPayload {
  readonly organizationId: string;
  readonly organizationSlug: string;
}

export interface LocationCreatedPayload {
  readonly locationId: string;
}

export interface MemberJoinedPayload {
  readonly memberId: string;
  readonly userId: string;
}

export interface OrganizationRenamedPayload {
  readonly organizationId: string;
}

/** An organization changed its status (suspended or reactivated); the reason stays in the platform audit log. */
export interface OrganizationStatusPayload {
  readonly organizationId: string;
}

/** Ids only: the invitation token and the invitee's phone or email never travel in an event. */
export interface InvitationPayload {
  readonly invitationId: string;
}

/** The payload of each event type. `publishEvent` takes its payload type from this map. */
export interface EventPayloadMap {
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_CREATED]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_ACTIVATED]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_FROZEN]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_UNFROZEN]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_CANCELLED]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWED]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_EXPIRED]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_COMPLETED]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_OVERDUE]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWAL_DUE]: EnrollmentEventPayload;
  readonly [ENROLLMENT_EVENT_TYPE.ENROLLMENT_CHECK_IN_RECORDED]: CheckInEventPayload;
  readonly [IAM_EVENT_TYPE.USER_REGISTERED]: UserRegisteredPayload;
  readonly [IAM_EVENT_TYPE.ROLE_CREATED]: RolePayload;
  readonly [IAM_EVENT_TYPE.ROLE_PERMISSIONS_CHANGED]: RolePayload;
  readonly [IAM_EVENT_TYPE.ROLE_ARCHIVED]: RolePayload;
  readonly [ORGANIZATION_EVENT_TYPE.ORGANIZATION_CREATED]: OrganizationCreatedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.LOCATION_CREATED]: LocationCreatedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_JOINED]: MemberJoinedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.ORGANIZATION_RENAMED]: OrganizationRenamedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.LOCATION_UPDATED]: LocationCreatedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.LOCATION_ARCHIVED]: LocationCreatedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_INVITED]: InvitationPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_ASSIGNMENTS_CHANGED]: MemberJoinedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_SUSPENDED]: MemberJoinedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_REACTIVATED]: MemberJoinedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.MEMBER_REMOVED]: MemberJoinedPayload;
  readonly [ORGANIZATION_EVENT_TYPE.INVITATION_REVOKED]: InvitationPayload;
  readonly [ORGANIZATION_EVENT_TYPE.ORGANIZATION_SUSPENDED]: OrganizationStatusPayload;
  readonly [ORGANIZATION_EVENT_TYPE.ORGANIZATION_REACTIVATED]: OrganizationStatusPayload;
  readonly [ORGANIZATION_EVENT_TYPE.INDUSTRY_TEMPLATE_CHANGED]: OrganizationStatusPayload;
  readonly [CUSTOM_FIELD_EVENT_TYPE.DEFINITION_CHANGED]: CustomFieldDefinitionChangedPayload;
  readonly [SETTINGS_EVENT_TYPE.SETTING_CHANGED]: SettingChangedPayload;
  readonly [SETTINGS_EVENT_TYPE.TERM_CHANGED]: TermChangedPayload;
  readonly [SETTINGS_EVENT_TYPE.MODULE_TOGGLED]: ModuleToggledPayload;
  readonly [CONTACT_EVENT_TYPE.CONTACT_CREATED]: ContactEventPayload;
  readonly [CONTACT_EVENT_TYPE.CONTACT_UPDATED]: ContactEventPayload;
  readonly [CONTACT_EVENT_TYPE.CONTACT_ARCHIVED]: ContactEventPayload;
  readonly [CONTACT_EVENT_TYPE.CONTACT_ANONYMIZED]: ContactEventPayload;
  readonly [CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED]: CustomerOtpRequestedPayload;
  readonly [CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_BLOCKED]: CustomerAccountEventPayload;
  readonly [CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_UNBLOCKED]: CustomerAccountEventPayload;
  readonly [CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_ENDED]: CustomerAccountEventPayload;
  readonly [CATALOG_EVENT_TYPE.OFFERING_CREATED]: OfferingEventPayload;
  readonly [CATALOG_EVENT_TYPE.OFFERING_UPDATED]: OfferingEventPayload;
  readonly [CATALOG_EVENT_TYPE.OFFERING_PUBLISHED]: OfferingEventPayload;
  readonly [CATALOG_EVENT_TYPE.OFFERING_ARCHIVED]: OfferingEventPayload;
  readonly [CATALOG_EVENT_TYPE.OFFERING_PRICE_CHANGED]: OfferingEventPayload;
  readonly [ACCOUNTING_EVENT_TYPE.JOURNAL_POSTED]: JournalPostedPayload;
  readonly [EXPENSE_EVENT_TYPE.EXPENSE_POSTED]: ExpenseEventPayload;
  readonly [EXPENSE_EVENT_TYPE.EXPENSE_VOIDED]: ExpenseEventPayload;
  readonly [PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED]: PaymentEventPayload;
  readonly [PAYMENT_EVENT_TYPE.PAYMENT_REFUNDED]: PaymentEventPayload;
  readonly [PAYMENT_EVENT_TYPE.PAYMENT_REVERSED]: PaymentEventPayload;
  readonly [PAYMENT_EVENT_TYPE.STORE_CREDIT_CHANGED]: StoreCreditEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_HELD]: BookingEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_REQUESTED]: BookingEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_CONFIRMED]: BookingEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_RESCHEDULED]: BookingEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_CHECK_IN_RECORDED]: BookingEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_COMPLETED]: BookingEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_CANCELLED]: BookingEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_NO_SHOW_MARKED]: BookingEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_EXPIRED]: BookingEventPayload;
  readonly [BOOKING_EVENT_TYPE.BOOKING_REMINDED]: BookingReminderPayload;
  readonly [BOOKING_EVENT_TYPE.RESOURCE_CREATED]: ResourceEventPayload;
  readonly [BOOKING_EVENT_TYPE.RESOURCE_UPDATED]: ResourceEventPayload;
  readonly [BOOKING_EVENT_TYPE.RESOURCE_DEACTIVATED]: ResourceEventPayload;
  readonly [BOOKING_EVENT_TYPE.EVENT_SESSION_CANCELLED]: EventSessionEventPayload;
  readonly [PRICING_EVENT_TYPE.PROMOTION_CHANGED]: PromotionEventPayload;
  readonly [INVENTORY_EVENT_TYPE.STOCK_CHANGED]: InventoryStockChangedPayload;
  readonly [INVENTORY_EVENT_TYPE.STOCK_LOW]: InventoryStockLowPayload;
  readonly [INVENTORY_EVENT_TYPE.TRANSFER_COMPLETED]: InventoryTransferCompletedPayload;
  readonly [DIRECTORY_EVENT_TYPE.LISTING_SUBMITTED]: ListingEventPayload;
  readonly [DIRECTORY_EVENT_TYPE.LISTING_APPROVED]: ListingEventPayload;
  readonly [DIRECTORY_EVENT_TYPE.LISTING_REJECTED]: ListingEventPayload;
  readonly [DIRECTORY_EVENT_TYPE.LISTING_HIDDEN]: ListingEventPayload;
  readonly [DIRECTORY_EVENT_TYPE.LISTING_UNHIDDEN]: ListingEventPayload;
  readonly [DIRECTORY_EVENT_TYPE.LISTING_ARCHIVED]: ListingEventPayload;
  readonly [DIRECTORY_EVENT_TYPE.LISTING_UPDATED]: ListingEventPayload;
  readonly [DIRECTORY_EVENT_TYPE.LISTING_REPORT_FILED]: ListingReportFiledPayload;
  readonly [DIRECTORY_EVENT_TYPE.LISTING_REPORT_RESOLVED]: ListingReportResolvedPayload;
  readonly [CREDIT_EVENT_TYPE.CREDIT_ENTRY_CREATED]: CreditEntryCreatedPayload;
  readonly [CREDIT_EVENT_TYPE.UNLOCK_CREATED]: UnlockCreatedPayload;
  readonly [CREDIT_EVENT_TYPE.PURCHASE_SUBMITTED]: CreditPurchaseEventPayload;
  readonly [CREDIT_EVENT_TYPE.PURCHASE_VERIFIED]: CreditPurchaseEventPayload;
  readonly [CREDIT_EVENT_TYPE.PURCHASE_REJECTED]: CreditPurchaseEventPayload;
  readonly [CREDIT_EVENT_TYPE.PURCHASE_CANCELLED]: CreditPurchaseEventPayload;
  readonly [COMMISSION_EVENT_TYPE.ENTRY_RECORDED]: CommissionEntryRecordedPayload;
  readonly [SALES_EVENT_TYPE.ORDER_DRAFTED]: OrderEventPayload;
  readonly [SALES_EVENT_TYPE.ORDER_PLACED]: OrderEventPayload;
  readonly [SALES_EVENT_TYPE.ORDER_CONFIRMED]: OrderEventPayload;
  readonly [SALES_EVENT_TYPE.ORDER_UPDATED]: OrderEventPayload;
  readonly [SALES_EVENT_TYPE.ORDER_PACKED]: OrderEventPayload;
  readonly [SALES_EVENT_TYPE.ORDER_COMPLETED]: OrderEventPayload;
  readonly [SALES_EVENT_TYPE.ORDER_CANCELLED]: OrderEventPayload;
}

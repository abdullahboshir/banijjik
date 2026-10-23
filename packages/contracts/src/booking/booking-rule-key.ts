/** Business-rule keys of the booking module (422 `details.ruleKey`). */
export const BOOKING_RULE_KEY = {
  SLOT_UNAVAILABLE: "SLOT_UNAVAILABLE",
  RESOURCE_INACTIVE: "RESOURCE_INACTIVE",
  RESOURCE_WRONG_LOCATION: "RESOURCE_WRONG_LOCATION",
  RESOURCE_CANNOT_SERVE: "RESOURCE_CANNOT_SERVE",
  OFFERING_NOT_BOOKABLE: "OFFERING_NOT_BOOKABLE",
  SCHEDULE_OVERLAP: "SCHEDULE_OVERLAP",
  INVALID_MEMBER_ASSIGNMENT: "INVALID_MEMBER_ASSIGNMENT",
  UNKNOWN_RESOURCE_TYPE: "UNKNOWN_RESOURCE_TYPE",
  HOLD_EXPIRED: "HOLD_EXPIRED",
  BOOKING_NOT_SERVICE: "BOOKING_NOT_SERVICE",
  BOOKING_RENTAL_UNITS_OUT_OF_RANGE: "BOOKING_RENTAL_UNITS_OUT_OF_RANGE",
  BOOKING_RENTAL_DURATION_EXCEEDED: "BOOKING_RENTAL_DURATION_EXCEEDED",
} as const;

export type BookingRuleKey = (typeof BOOKING_RULE_KEY)[keyof typeof BOOKING_RULE_KEY];

/** Message keys the booking module sends, besides the kernel codes. Both catalogs need each. */
export const BOOKING_MESSAGE_KEYS: readonly string[] = [
  "errors.slot_unavailable",
  "errors.resource_inactive",
  "errors.resource_wrong_location",
  "errors.resource_cannot_serve",
  "errors.offering_not_bookable",
  "errors.schedule_overlap",
  "errors.invalid_member_assignment",
  "errors.unknown_resource_type",
  "errors.hold_expired",
  "errors.booking_not_service",
  "errors.capacity_full",
  "errors.booking_rental_units_out_of_range",
  "errors.booking_rental_duration_exceeded",
];

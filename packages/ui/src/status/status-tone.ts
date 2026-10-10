export type StatusTone = "success" | "info" | "warning" | "danger" | "neutral";
export type StatusRequestType = "ORDER" | "BOOKING" | "ENROLLMENT" | "PAYMENT" | "SALES_RETURN";

type ToneTable = Record<StatusRequestType, Readonly<Record<StatusTone, readonly string[]>>>;

/**
 * Single source of badge colours: docs/11-OFFERINGS-AND-REQUESTS.md section 12.
 * Status strings stay local until contracts gets the request status enums (D3 cards).
 */
export const STATUS_TONE_TABLE: ToneTable = {
  ORDER: {
    success: ["DELIVERED", "COMPLETED"],
    info: ["CONFIRMED", "PACKED", "SHIPPED"],
    warning: ["PLACED", "DELIVERY_FAILED"],
    danger: ["CANCELLED", "RETURNED_TO_SENDER"],
    neutral: ["DRAFT"],
  },
  BOOKING: {
    success: ["COMPLETED", "CHECKED_IN"],
    info: ["CONFIRMED"],
    warning: ["HELD", "REQUESTED"],
    danger: ["CANCELLED", "NO_SHOW"],
    neutral: [],
  },
  ENROLLMENT: {
    success: ["ACTIVE", "COMPLETED"],
    info: [],
    warning: ["PENDING", "FROZEN", "OVERDUE"],
    danger: ["CANCELLED"],
    neutral: ["EXPIRED"],
  },
  PAYMENT: {
    success: ["PAID"],
    info: [],
    warning: ["PARTIAL", "UNPAID"],
    danger: [],
    neutral: ["REFUNDED", "PARTIALLY_REFUNDED"],
  },
  SALES_RETURN: {
    success: [],
    info: ["ACTIVE"],
    warning: [],
    danger: [],
    neutral: ["REVERSED"],
  },
};

const TONES: readonly StatusTone[] = ["success", "info", "warning", "danger", "neutral"];

/** An unknown status is neutral, so a new backend status never breaks a screen. */
export function statusTone(requestType: StatusRequestType, status: string): StatusTone {
  const table = STATUS_TONE_TABLE[requestType];
  return TONES.find((tone) => table[tone].includes(status)) ?? "neutral";
}

import type {
  SmsFailureReason,
  SmsOutcome,
  SmsProvider,
  SmsPurpose,
  SmsSource,
} from "@banijjik/contracts/sms";
import type { SmsGatewayInput } from "@banijjik/validation/sms";
import { apiFetch } from "../lib/api/api-client";

/** The gateway as the API reads it: secrets are only reported as saved or not, never sent back. */
export interface SmsGatewayView {
  readonly enabled: boolean;
  readonly activeProvider: SmsProvider | null;
  readonly adareach: {
    readonly username: string;
    readonly senderId: string;
    readonly hasPassword: boolean;
  } | null;
  readonly bulksmsbd: { readonly senderId: string; readonly hasApiKey: boolean } | null;
  readonly version: number;
  readonly updatedAt: string;
  /** Which account sends the messages now: the business's own, the platform's, or none. */
  readonly source: SmsSource;
}

/** What one test send reports; a transient fault with no answer comes back as a 502 instead. */
export interface SmsTestResult {
  readonly source: SmsSource;
  readonly provider: SmsProvider | null;
  readonly outcome: SmsOutcome;
  readonly failureReason: SmsFailureReason | null;
  readonly providerErrorCode: number | null;
}

export interface SmsLogItem {
  readonly smsLogId: string;
  readonly purpose: SmsPurpose;
  readonly phoneLastDigits: string;
  readonly outcome: SmsOutcome;
  readonly failureReason: SmsFailureReason | null;
  readonly createdAt: string;
}

export interface SmsLogPage {
  readonly items: SmsLogItem[];
  readonly nextCursor: string | null;
}

/** The page size of the last-sends list. */
export const SMS_LOG_PAGE_SIZE = 25;

export async function saveSmsGateway(
  organizationId: string,
  body: SmsGatewayInput,
): Promise<SmsGatewayView> {
  const result = await apiFetch<SmsGatewayView>(`/orgs/${organizationId}/sms/gateway`, {
    method: "PUT",
    body,
  });
  return result.data;
}

export async function testSmsGateway(
  organizationId: string,
  phoneE164: string,
): Promise<SmsTestResult> {
  const result = await apiFetch<SmsTestResult>(`/orgs/${organizationId}/sms/gateway/test`, {
    method: "POST",
    body: { phoneE164 },
  });
  return result.data;
}

export async function fetchSmsLogs(
  organizationId: string,
  cursor: string | null,
): Promise<SmsLogPage> {
  const cursorQuery = cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`;
  const result = await apiFetch<SmsLogPage>(
    `/orgs/${organizationId}/sms/logs?limit=${SMS_LOG_PAGE_SIZE}${cursorQuery}`,
  );
  return result.data;
}

import type { SmsFailureReason, SmsOutcome, SmsProvider, SmsSource } from "@banijjik/contracts/sms";
import type { SmsGatewayInput } from "@banijjik/validation/sms";
import { apiFetch } from "../api/platform-api-client";

/** The default gateway as the platform API reads it: secrets are only reported as saved or not. */
export interface PlatformSmsGatewayView {
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
  readonly source: SmsSource;
}

/** What one test send reports; a transient fault with no answer comes back as a 502 instead. */
export interface PlatformSmsTestResult {
  readonly source: SmsSource;
  readonly provider: SmsProvider | null;
  readonly outcome: SmsOutcome;
  readonly failureReason: SmsFailureReason | null;
  readonly providerErrorCode: number | null;
}

export async function savePlatformSmsGateway(
  body: SmsGatewayInput,
): Promise<PlatformSmsGatewayView> {
  const result = await apiFetch<PlatformSmsGatewayView>("/platform/sms-gateway", {
    method: "PUT",
    body,
  });
  return result.data;
}

export async function testPlatformSmsGateway(phoneE164: string): Promise<PlatformSmsTestResult> {
  const result = await apiFetch<PlatformSmsTestResult>("/platform/sms-gateway/test", {
    method: "POST",
    body: { phoneE164 },
  });
  return result.data;
}

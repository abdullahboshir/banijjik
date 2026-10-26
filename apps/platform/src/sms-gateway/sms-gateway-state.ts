import { SMS_PROVIDER, type SmsProvider } from "@banijjik/contracts/sms";
import type { SmsGatewayInput } from "@banijjik/validation/sms";
import type { PlatformSmsGatewayView } from "./sms-gateway-api";

/** The form's own values. A secret box starts empty: the stored secret is never sent back to the screen. */
export interface SmsGatewayFormState {
  readonly enabled: boolean;
  readonly activeProvider: SmsProvider | null;
  readonly adareachUsername: string;
  readonly adareachPassword: string;
  readonly adareachSenderId: string;
  readonly bulksmsbdApiKey: string;
  readonly bulksmsbdSenderId: string;
}

export function gatewayFormStateOf(view: PlatformSmsGatewayView): SmsGatewayFormState {
  return {
    enabled: view.enabled,
    activeProvider: view.activeProvider,
    adareachUsername: view.adareach?.username ?? "",
    adareachPassword: "",
    adareachSenderId: view.adareach?.senderId ?? "",
    bulksmsbdApiKey: "",
    bulksmsbdSenderId: view.bulksmsbd?.senderId ?? "",
  };
}

/** An omitted part keeps the stored one; an empty password or key box keeps the stored secret. */
function adareachBodyOf(
  state: SmsGatewayFormState,
  view: PlatformSmsGatewayView,
): SmsGatewayInput["adareach"] {
  const hasAnyValue =
    view.adareach !== null ||
    state.adareachUsername !== "" ||
    state.adareachPassword !== "" ||
    state.adareachSenderId !== "";
  if (!hasAnyValue) return undefined;
  const part = { username: state.adareachUsername, senderId: state.adareachSenderId };
  return state.adareachPassword === "" ? part : { ...part, password: state.adareachPassword };
}

function bulksmsbdBodyOf(
  state: SmsGatewayFormState,
  view: PlatformSmsGatewayView,
): SmsGatewayInput["bulksmsbd"] {
  const hasAnyValue =
    view.bulksmsbd !== null || state.bulksmsbdApiKey !== "" || state.bulksmsbdSenderId !== "";
  if (!hasAnyValue) return undefined;
  const part = { senderId: state.bulksmsbdSenderId };
  return state.bulksmsbdApiKey === "" ? part : { ...part, apiKey: state.bulksmsbdApiKey };
}

/** The save body: the version the page was drawn from, and only the parts the person has set. */
export function buildGatewayBody(
  state: SmsGatewayFormState,
  view: PlatformSmsGatewayView,
): SmsGatewayInput {
  return {
    version: view.version,
    enabled: state.enabled,
    activeProvider: state.activeProvider,
    adareach: adareachBodyOf(state, view),
    bulksmsbd: bulksmsbdBodyOf(state, view),
  };
}

export function providerFromSelectValue(value: string): SmsProvider | null {
  if (value === SMS_PROVIDER.ADAREACH) return SMS_PROVIDER.ADAREACH;
  if (value === SMS_PROVIDER.BULKSMSBD) return SMS_PROVIDER.BULKSMSBD;
  return null;
}

import type { SmsProvider } from "@banijjik/contracts/sms";

const BANGLADESH_MOBILE_PATTERN = /^\+8801[3-9]\d{8}$/;

export function isBangladeshMobile(phoneE164: string): boolean {
  return BANGLADESH_MOBILE_PATTERN.test(phoneE164);
}

export interface Gateway {
  readonly enabled: boolean;
  readonly activeProvider: SmsProvider | null;
  readonly adareach: {
    readonly username: string;
    readonly passwordSealed: string;
    readonly senderId: string;
  } | null;
  readonly bulksmsbd: { readonly apiKeySealed: string; readonly senderId: string } | null;
  readonly version: number;
  readonly updatedAt: Date;
}

export function isComplete(gateway: Gateway): boolean {
  if (gateway.activeProvider === "ADAREACH") {
    const provider = gateway.adareach;
    return (
      provider !== null &&
      Boolean(provider.username && provider.passwordSealed && provider.senderId)
    );
  }
  if (gateway.activeProvider === "BULKSMSBD") {
    const provider = gateway.bulksmsbd;
    return provider !== null && Boolean(provider.apiKeySealed && provider.senderId);
  }
  return false;
}

export function emptyGateway(): Gateway {
  return {
    enabled: false,
    activeProvider: null,
    adareach: null,
    bulksmsbd: null,
    version: 0,
    updatedAt: new Date(0),
  };
}

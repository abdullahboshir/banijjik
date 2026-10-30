export interface CheckoutContactSnapshot {
  readonly name: string;
  readonly phoneE164: string;
  readonly customFields: Readonly<Record<string, unknown>>;
}

export interface CreateProvisionalContactInput {
  readonly organizationId: string;
  readonly guestSessionId: string;
  readonly name: string;
  readonly phoneE164: string;
  readonly customFields?: Readonly<Record<string, unknown>>;
}

export interface ProvisionalContactResult {
  readonly contactId: string;
  readonly contactSnapshot: CheckoutContactSnapshot;
}

export interface ContactProvisionalCreatedPayload {
  readonly contactId: string;
  readonly guestSessionId: string;
}

export type ProvisionalContactCreatedPayload = ContactProvisionalCreatedPayload;

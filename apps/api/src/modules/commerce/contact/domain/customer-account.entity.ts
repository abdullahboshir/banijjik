import { CUSTOMER_ACCOUNT_STATUS, type CustomerAccountStatus } from "@banijjik/contracts/contact";
import { newId, type ContactId, type CustomerAccountId, type UserId } from "@banijjik/ids";
import { invalidTransition } from "./errors.js";

export interface CustomerAccountProps {
  readonly customerAccountId: CustomerAccountId;
  readonly contactId: ContactId;
  readonly phoneE164: string;
  readonly status: CustomerAccountStatus;
  readonly verifiedAt: Date;
  readonly lastLoginAt: Date;
  readonly blockedAt: Date | undefined;
  readonly blockedByUserId: UserId | undefined;
  readonly version: number;
  readonly createdAt: Date;
}

/**
 * A customer's login to the business's public site, tied to the business's Contact for the phone.
 * It is never a User or a Member (ADR-045): it proves one phone number to one business.
 */
export class CustomerAccount implements CustomerAccountProps {
  readonly customerAccountId: CustomerAccountId;
  readonly contactId: ContactId;
  readonly phoneE164: string;
  readonly status: CustomerAccountStatus;
  readonly verifiedAt: Date;
  readonly lastLoginAt: Date;
  readonly blockedAt: Date | undefined;
  readonly blockedByUserId: UserId | undefined;
  readonly version: number;
  readonly createdAt: Date;

  private constructor(props: CustomerAccountProps) {
    this.customerAccountId = props.customerAccountId;
    this.contactId = props.contactId;
    this.phoneE164 = props.phoneE164;
    this.status = props.status;
    this.verifiedAt = props.verifiedAt;
    this.lastLoginAt = props.lastLoginAt;
    this.blockedAt = props.blockedAt;
    this.blockedByUserId = props.blockedByUserId;
    this.version = props.version;
    this.createdAt = props.createdAt;
  }

  /** The first successful code proves the phone, so a new account is verified from the start. */
  static createVerified(input: {
    readonly contactId: ContactId;
    readonly phoneE164: string;
    readonly now: Date;
  }): CustomerAccount {
    return new CustomerAccount({
      customerAccountId: newId(),
      contactId: input.contactId,
      phoneE164: input.phoneE164,
      status: CUSTOMER_ACCOUNT_STATUS.ACTIVE,
      verifiedAt: input.now,
      lastLoginAt: input.now,
      blockedAt: undefined,
      blockedByUserId: undefined,
      version: 1,
      createdAt: input.now,
    });
  }

  static restore(props: CustomerAccountProps): CustomerAccount {
    return new CustomerAccount(props);
  }

  isActive(): boolean {
    return this.status === CUSTOMER_ACCOUNT_STATUS.ACTIVE;
  }

  withLogin(now: Date): CustomerAccount {
    return new CustomerAccount({ ...this.props(), lastLoginAt: now });
  }

  /** Blocking an already blocked account is refused, so a double click does not write a second audit entry. */
  block(by: UserId, now: Date): CustomerAccount {
    if (!this.isActive()) throw invalidTransition(this.status);
    return new CustomerAccount({
      ...this.props(),
      status: CUSTOMER_ACCOUNT_STATUS.BLOCKED,
      blockedAt: now,
      blockedByUserId: by,
    });
  }

  unblock(): CustomerAccount {
    if (this.isActive()) throw invalidTransition(this.status);
    return new CustomerAccount({
      ...this.props(),
      status: CUSTOMER_ACCOUNT_STATUS.ACTIVE,
      blockedAt: undefined,
      blockedByUserId: undefined,
    });
  }

  private props(): CustomerAccountProps {
    return { ...this };
  }
}

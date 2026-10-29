import {
  asId,
  newId,
  type DomainOperationId,
  type OrganizationId,
  type SiteDomainId,
  type UserId,
} from "@banijjik/ids";

export const DOMAIN_OPERATION_ACTION = {
  ENSURE: "ENSURE",
  REMOVE: "REMOVE",
} as const;
export type DomainOperationAction =
  (typeof DOMAIN_OPERATION_ACTION)[keyof typeof DOMAIN_OPERATION_ACTION];

export const DOMAIN_OPERATION_STATE = {
  IN_FLIGHT: "IN_FLIGHT",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
} as const;
export type DomainOperationState =
  (typeof DOMAIN_OPERATION_STATE)[keyof typeof DOMAIN_OPERATION_STATE];

export interface DomainOperationProps {
  readonly domainOperationId: DomainOperationId;
  readonly organizationId: OrganizationId;
  readonly siteDomainId: SiteDomainId;
  readonly generation: number;
  readonly action: DomainOperationAction;
  readonly providerHostnameId: string | null;
  readonly state: DomainOperationState;
  readonly nextAttemptAt: Date;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface StartDomainOperationInput {
  readonly organizationId: OrganizationId;
  readonly siteDomainId: SiteDomainId;
  readonly generation: number;
  readonly action: DomainOperationAction;
  readonly now: Date;
}

/**
 * One provider call for one SiteDomain generation (plan 4.2 audit correction). Not a ledger and
 * not domain authority: it only remembers an in-flight Cloudflare create/delete so a lost HTTP
 * response can be reconciled by hostname.
 */
export class DomainOperation {
  private constructor(private readonly props: DomainOperationProps) {}

  static start(input: StartDomainOperationInput): DomainOperation {
    return new DomainOperation({
      domainOperationId: asId<DomainOperationId>(newId()),
      organizationId: input.organizationId,
      siteDomainId: input.siteDomainId,
      generation: input.generation,
      action: input.action,
      providerHostnameId: null,
      state: DOMAIN_OPERATION_STATE.IN_FLIGHT,
      nextAttemptAt: input.now,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: null,
      updatedByUserId: null,
    });
  }

  static rehydrate(props: DomainOperationProps): DomainOperation {
    return new DomainOperation(props);
  }

  get domainOperationId(): DomainOperationId {
    return this.props.domainOperationId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get siteDomainId(): SiteDomainId {
    return this.props.siteDomainId;
  }

  get generation(): number {
    return this.props.generation;
  }

  get action(): DomainOperationAction {
    return this.props.action;
  }

  get providerHostnameId(): string | null {
    return this.props.providerHostnameId;
  }

  get state(): DomainOperationState {
    return this.props.state;
  }

  get nextAttemptAt(): Date {
    return this.props.nextAttemptAt;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdByUserId(): UserId | null {
    return this.props.createdByUserId;
  }

  get updatedByUserId(): UserId | null {
    return this.props.updatedByUserId;
  }

  succeed(input: {
    readonly providerHostnameId: string | null;
    readonly now: Date;
  }): DomainOperation {
    return new DomainOperation({
      ...this.props,
      providerHostnameId: input.providerHostnameId,
      state: DOMAIN_OPERATION_STATE.SUCCEEDED,
      version: this.props.version + 1,
      updatedAt: input.now,
    });
  }

  fail(input: { readonly now: Date }): DomainOperation {
    return new DomainOperation({
      ...this.props,
      state: DOMAIN_OPERATION_STATE.FAILED,
      version: this.props.version + 1,
      updatedAt: input.now,
    });
  }

  attachProviderHostname(input: {
    readonly providerHostnameId: string;
    readonly now: Date;
  }): DomainOperation {
    return new DomainOperation({
      ...this.props,
      providerHostnameId: input.providerHostnameId,
      version: this.props.version + 1,
      updatedAt: input.now,
    });
  }
}

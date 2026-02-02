export interface PermissionProps {
  permissionId?: string;
  domain: string;
  resource: string;
  action: string;
  scope: string;
  effect: string;
  description: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Permission {
  constructor(private readonly props: PermissionProps) {}

  get permissionId(): string | undefined {
    return this.props.permissionId;
  }
  get domain(): string {
    return this.props.domain;
  }
  get resource(): string {
    return this.props.resource;
  }
  get action(): string {
    return this.props.action;
  }
  get scope(): string {
    return this.props.scope;
  }
  get effect(): string {
    return this.props.effect;
  }

  toObject() {
    return { ...this.props };
  }

  static create(props: PermissionProps): Permission {
    return new Permission({
      ...props,
      permissionId: props.permissionId ?? crypto.randomUUID(),
    });
  }
}

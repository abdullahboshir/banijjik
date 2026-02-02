export interface RoleProps {
  roleId?: string;
  name: string;
  key: string; // e.g., 'ORGANIZATION_ADMIN'
  organizationId?: string; // null for platform-level roles
  permissions: string[]; // array of Permission IDs
  isSystem: boolean; // prevent deletion of core roles
  createdAt?: Date;
  updatedAt?: Date;
}

export class Role {
  constructor(private readonly props: RoleProps) {}

  get roleId(): string | undefined {
    return this.props.roleId;
  }
  get name(): string {
    return this.props.name;
  }
  get key(): string {
    return this.props.key;
  }
  get organizationId(): string | undefined {
    return this.props.organizationId;
  }
  get permissions(): string[] {
    return this.props.permissions;
  }
  get isSystem(): boolean {
    return this.props.isSystem;
  }

  toObject() {
    return { ...this.props };
  }

  static create(props: RoleProps): Role {
    return new Role({
      ...props,
      roleId: props.roleId ?? crypto.randomUUID(),
    });
  }
}

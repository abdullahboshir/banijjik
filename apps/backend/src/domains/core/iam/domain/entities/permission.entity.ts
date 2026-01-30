export interface PermissionProps {
  id?: string;
  name: string;
  key: string; // e.g., 'create:invoice'
  module: string; // e.g., 'CORE_BILLING'
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Permission {
  constructor(private readonly props: PermissionProps) {}

  get id(): string | undefined {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get key(): string {
    return this.props.key;
  }
  get module(): string {
    return this.props.module;
  }

  toObject() {
    return { ...this.props };
  }

  static create(props: PermissionProps): Permission {
    return new Permission(props);
  }
}

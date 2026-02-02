export interface RoleProps {
    roleId?: string;
    name: string;
    key: string;
    organizationId?: string;
    permissions: string[];
    isSystem: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare class Role {
    private readonly props;
    constructor(props: RoleProps);
    get roleId(): string | undefined;
    get name(): string;
    get key(): string;
    get organizationId(): string | undefined;
    get permissions(): string[];
    get isSystem(): boolean;
    toObject(): {
        roleId?: string;
        name: string;
        key: string;
        organizationId?: string;
        permissions: string[];
        isSystem: boolean;
        createdAt?: Date;
        updatedAt?: Date;
    };
    static create(props: RoleProps): Role;
}
//# sourceMappingURL=role.entity.d.ts.map
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
export declare class Permission {
    private readonly props;
    constructor(props: PermissionProps);
    get permissionId(): string | undefined;
    get domain(): string;
    get resource(): string;
    get action(): string;
    get scope(): string;
    get effect(): string;
    toObject(): {
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
    };
    static create(props: PermissionProps): Permission;
}
//# sourceMappingURL=permission.entity.d.ts.map
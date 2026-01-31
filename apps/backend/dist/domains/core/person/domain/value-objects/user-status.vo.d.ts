import { UserStatusType } from "@banijjik/contracts";
export declare class UserStatus {
    private readonly value;
    private constructor();
    private static readonly registry;
    static get VALUE(): Readonly<typeof UserStatus.registry>;
    static from(value: string): UserStatus;
    static all(): UserStatus[];
    getValue(): UserStatusType;
    equals(other: UserStatus): boolean;
}
//# sourceMappingURL=user-status.vo.d.ts.map
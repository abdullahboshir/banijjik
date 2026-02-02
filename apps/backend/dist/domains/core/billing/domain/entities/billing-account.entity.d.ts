import { TransactionStatus } from "../value-object/billing-account-status.vo";
export interface BillingAccountProps {
    billingAccountId: string;
    ownerId: string;
    ownerType: string;
    currency: string;
    balance: number;
    status: TransactionStatus;
    createdAt: Date;
    updatedAt: Date;
}
export declare class BillingAccount {
    private props;
    constructor(inputProps: BillingAccountProps);
    get billingAccountId(): string | undefined;
    get ownerId(): string;
    get ownerType(): string;
    get currency(): string;
    get balance(): number;
    get status(): TransactionStatus;
    get createdAt(): Date;
    get updatedAt(): Date;
    credit(amount: number): void;
    debit(amount: number): void;
    changeStatus(newStatus: TransactionStatus): void;
    private touch;
}
//# sourceMappingURL=billing-account.entity.d.ts.map
import { TransactionStatus } from "../value-object/billing-account-status.vo";
export class BillingAccount {
    constructor(inputProps) {
        this.props = {
            ...inputProps,
            status: inputProps.status ?? TransactionStatus.VALUE.ACTIVE,
            createdAt: inputProps.createdAt ?? new Date(),
            updatedAt: inputProps.updatedAt ?? new Date(),
        };
    }
    get billingAccountId() {
        return this.props.billingAccountId;
    }
    get ownerId() {
        return this.props.ownerId;
    }
    get ownerType() {
        return this.props.ownerType;
    }
    get currency() {
        return this.props.currency;
    }
    get balance() {
        return this.props.balance;
    }
    get status() {
        return this.props.status;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    credit(amount) {
        if (amount <= 0)
            throw new Error("Credit amount must be positive");
        this.props.balance += amount;
        this.touch();
    }
    debit(amount) {
        if (amount <= 0)
            throw new Error("Debit amount must be positive");
        if (this.props.balance < amount)
            throw new Error("Insufficient balance");
        this.props.balance -= amount;
        this.touch();
    }
    changeStatus(newStatus) {
        this.props.status = newStatus;
        this.touch();
    }
    touch() {
        this.props.updatedAt = new Date();
    }
}
//# sourceMappingURL=billing-account.entity.js.map
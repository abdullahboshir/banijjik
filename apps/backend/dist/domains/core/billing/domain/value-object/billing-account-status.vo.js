const TRANSACTION_STATUS_VALUES = [
    'ACTIVE',
    'SUSPENDED',
    'CLOSED',
    'BLACKLISTED',
];
export class TransactionStatus {
    constructor(value) {
        this.value = value;
    }
    // Friendly API
    static get VALUE() {
        return this.registry;
    }
    // O(1) Factory
    static from(value) {
        const key = value.toUpperCase();
        const status = this.registry[key];
        if (!status) {
            throw new Error(`Invalid TransactionStatus: ${value}`);
        }
        return status;
    }
    static all() {
        return Object.values(this.registry);
    }
    getValue() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
// Registry
TransactionStatus.registry = (() => {
    const map = {};
    for (const status of TRANSACTION_STATUS_VALUES) {
        map[status] = new TransactionStatus(status);
    }
    return map;
})();
//# sourceMappingURL=billing-account-status.vo.js.map
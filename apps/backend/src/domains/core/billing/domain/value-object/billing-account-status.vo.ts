 const TRANSACTION_STATUS_VALUES = [
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
  'BLACKLISTED',
 ] as const;


type TransactionStatusType = typeof TRANSACTION_STATUS_VALUES[number];

export class TransactionStatus {
  private constructor(
    private readonly value: TransactionStatusType
  ) {}

  // Registry
  private static readonly registry: Record<TransactionStatusType, TransactionStatus> = (() => {
    const map = {} as Record<TransactionStatusType, TransactionStatus>;

    for (const status of TRANSACTION_STATUS_VALUES) {
      map[status] = new TransactionStatus(status);
    }

    return map;
  })();

  // Friendly API
  static get VALUE(): Readonly<typeof TransactionStatus.registry> {
    return this.registry;
  }

  // O(1) Factory
  static from(value: string): TransactionStatus {
    const key = value.toUpperCase() as TransactionStatusType;

    const status = this.registry[key];

    if (!status) {
      throw new Error(`Invalid TransactionStatus: ${value}`);
    }

    return status;
  }

  static all(): TransactionStatus[] {
    return Object.values(this.registry);
  }

  getValue(): TransactionStatusType {
    return this.value;
  }

  equals(other: TransactionStatus): boolean {
    return this.value === other.value;
  }
}

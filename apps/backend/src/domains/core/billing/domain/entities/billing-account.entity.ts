import { TransactionStatus } from "../value-object/billing-account-status.vo";

export interface BillingAccountProps {
  id: string;
  ownerId: string;
  ownerType: string;
  currency: string;
  balance: number;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class BillingAccount {
  private props: BillingAccountProps & {
    id: string;
    ownerId: string;
    ownerType: string;
    status: TransactionStatus;
  };

  constructor(inputProps: BillingAccountProps) {
    this.props = {
      ...inputProps,
      status: inputProps.status ?? TransactionStatus.VALUE.ACTIVE,
      createdAt: inputProps.createdAt ?? new Date(),
      updatedAt: inputProps.updatedAt ?? new Date(),
    };
  }

  get id(): string | undefined {
    return this.props.id;
  }
  get ownerId(): string {
    return this.props.ownerId;
  }
  get ownerType(): string {
    return this.props.ownerType;
  }
  get currency(): string {
    return this.props.currency;
  }
  get balance(): number {
    return this.props.balance;
  }
  get status(): TransactionStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public credit(amount: number): void {
    if (amount <= 0) throw new Error("Credit amount must be positive");
    this.props.balance += amount;
    this.touch();
  }

  public debit(amount: number): void {
    if (amount <= 0) throw new Error("Debit amount must be positive");
    if (this.props.balance < amount) throw new Error("Insufficient balance");

    this.props.balance -= amount;
    this.touch();
  }

  public changeStatus(newStatus: TransactionStatus): void {
    this.props.status = newStatus;
    this.touch();
  }

  private touch() {
    this.props.updatedAt = new Date();
  }
}

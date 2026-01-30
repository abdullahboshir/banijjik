import { USER_STATUS_ENUM, UserStatusType } from "@banijjik/contracts";

export class UserStatus {
  private constructor(private readonly value: UserStatusType) {}

  // Registry
  private static readonly registry: Record<UserStatusType, UserStatus> =
    (() => {
      const map = {} as Record<UserStatusType, UserStatus>;

      for (const status of USER_STATUS_ENUM) {
        map[status] = new UserStatus(status);
      }

      return map;
    })();

  // Friendly API
  static get VALUE(): Readonly<typeof UserStatus.registry> {
    return this.registry;
  }

  // O(1) Factory
  static from(value: string): UserStatus {
    const key = value.toUpperCase() as UserStatusType;

    const status = this.registry[key];

    if (!status) {
      throw new Error(`Invalid UserStatus: ${value}`);
    }

    return status;
  }

  static all(): UserStatus[] {
    return Object.values(this.registry);
  }

  getValue(): UserStatusType {
    return this.value;
  }

  equals(other: UserStatus): boolean {
    return this.value === other.value;
  }
}

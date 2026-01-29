import { USER_PROFILE_TYPE_ENUM, UserProfileType } from "@banijjik/contracts";

export class ProfileType {
  private constructor(private readonly value: UserProfileType) {}

  // Registry
  private static readonly registry: Record<UserProfileType, ProfileType> =
    (() => {
      const map = {} as Record<UserProfileType, ProfileType>;

      for (const type of USER_PROFILE_TYPE_ENUM) {
        map[type] = new ProfileType(type);
      }

      return map;
    })();

  // Friendly API
  static get VALUE(): Readonly<typeof ProfileType.registry> {
    return this.registry;
  }

  // O(1) Factory
  static from(value: string): ProfileType {
    const key = value.toUpperCase() as UserProfileType;

    const type = this.registry[key];

    if (!type) {
      throw new Error(`Invalid ProfileType: ${value}`);
    }

    return type;
  }

  static all(): ProfileType[] {
    return Object.values(this.registry);
  }

  getValue(): UserProfileType {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: ProfileType): boolean {
    return this.value === other.value;
  }

  isGuest(): boolean {
    return this.equals(ProfileType.VALUE.GUEST);
  }
}

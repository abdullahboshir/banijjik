import {
  PREFERRED_LOCALE,
  USER_STATUS,
  type PreferredLocale,
  type UserStatus,
} from "@banijjik/contracts";
import { newId, type UserId } from "@banijjik/ids";
import { accountDisabled, accountLocked, invalidField } from "./errors.js";

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export interface UserProps {
  readonly userId: UserId;
  readonly name: string;
  readonly email: string | undefined;
  readonly phoneE164: string | undefined;
  readonly passwordHash: string;
  readonly status: UserStatus;
  readonly emailVerifiedAt: Date | undefined;
  readonly phoneVerifiedAt: Date | undefined;
  readonly preferredLocale: PreferredLocale;
  readonly avatarFileId: string | undefined;
  readonly lastLoginAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewUserInput {
  readonly name: string;
  readonly email?: string | undefined;
  readonly phoneE164?: string | undefined;
  readonly passwordHash: string;
  readonly preferredLocale?: PreferredLocale | undefined;
  readonly now: Date;
}

export interface ProfileChanges {
  readonly name?: string | undefined;
  readonly preferredLocale?: PreferredLocale | undefined;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A user needs a way to log in: an email, a phone number, or both. */
export function assertHasIdentifier(
  email: string | undefined,
  phoneE164: string | undefined,
): void {
  if (email === undefined && phoneE164 === undefined) {
    throw invalidField("email", "validation.identifier_required");
  }
}

function assertPhoneIsE164(phoneE164: string | undefined): void {
  if (phoneE164 !== undefined && !E164_PATTERN.test(phoneE164)) {
    throw invalidField("phone", "validation.invalid_format");
  }
}

function assertNameIsPresent(name: string): void {
  if (name.trim().length === 0) throw invalidField("name", "validation.too_small");
}

/** The login identity of a person (09 section 4.1). Holds no staff or customer data (ADR-046). */
export class User implements UserProps {
  readonly userId: UserId;
  readonly name: string;
  readonly email: string | undefined;
  readonly phoneE164: string | undefined;
  readonly passwordHash: string;
  readonly status: UserStatus;
  readonly emailVerifiedAt: Date | undefined;
  readonly phoneVerifiedAt: Date | undefined;
  readonly preferredLocale: PreferredLocale;
  readonly avatarFileId: string | undefined;
  readonly lastLoginAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.userId = props.userId;
    this.name = props.name;
    this.email = props.email;
    this.phoneE164 = props.phoneE164;
    this.passwordHash = props.passwordHash;
    this.status = props.status;
    this.emailVerifiedAt = props.emailVerifiedAt;
    this.phoneVerifiedAt = props.phoneVerifiedAt;
    this.preferredLocale = props.preferredLocale;
    this.avatarFileId = props.avatarFileId;
    this.lastLoginAt = props.lastLoginAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** A new, active account. Checks the invariants; verification starts empty. */
  static create(input: NewUserInput): User {
    const email = input.email === undefined ? undefined : normalizeEmail(input.email);
    assertHasIdentifier(email, input.phoneE164);
    assertPhoneIsE164(input.phoneE164);
    assertNameIsPresent(input.name);
    return new User({
      userId: newId(),
      name: input.name.trim(),
      email,
      phoneE164: input.phoneE164,
      passwordHash: input.passwordHash,
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: undefined,
      phoneVerifiedAt: undefined,
      preferredLocale: input.preferredLocale ?? PREFERRED_LOCALE.bn,
      avatarFileId: undefined,
      lastLoginAt: undefined,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /** Rebuilds a stored user. The stored data was checked when it was written. */
  static restore(props: UserProps): User {
    return new User(props);
  }

  /** A copy with the edited profile fields; the repository bumps the version on save. */
  withProfile(changes: ProfileChanges): User {
    if (changes.name !== undefined) assertNameIsPresent(changes.name);
    return new User({
      ...this,
      name: changes.name === undefined ? this.name : changes.name.trim(),
      preferredLocale: changes.preferredLocale ?? this.preferredLocale,
    });
  }

  /** Only an ACTIVE account may log in or renew a session. */
  assertCanAuthenticate(): void {
    if (this.status === USER_STATUS.LOCKED) throw accountLocked();
    if (this.status === USER_STATUS.DISABLED) throw accountDisabled();
  }
}

export class UserName {
  private readonly firstName: string;
  private readonly lastName: string | null;

  private constructor(firstName: string, lastName: string | null) {
    this.firstName = firstName;
    this.lastName = lastName;
  }

  static create(firstName: string, lastName?: string | null): UserName {
    if (!firstName || firstName.trim().length === 0) {
      throw new Error('validation.user.first_name_required');
    }

    if (firstName.length > 50) {
      throw new Error('validation.user.first_name_max');
    }

    if (lastName && lastName.length > 50) {
      throw new Error('validation.user.last_name_max');
    }

    return new UserName(
      firstName.trim(),
      lastName ? lastName.trim() : null
    );
  }

  getFirstName(): string {
    return this.firstName;
  }

  getLastName(): string | null {
    return this.lastName;
  }

  getFullName(): string {
    if (this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName;
  }

  toObject(): { firstName: string; lastName?: string } {
    const obj: { firstName: string; lastName?: string } = {
      firstName: this.firstName,
    };
    if (this.lastName) {
      obj.lastName = this.lastName;
    }
    return obj;
  }

  equals(other: UserName): boolean {
    return (
      this.firstName === other.firstName && this.lastName === other.lastName
    );
  }
}

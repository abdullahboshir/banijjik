export class Password {
  private readonly value: string;
  private readonly isHashed: boolean;

  private constructor(password: string, isHashed: boolean) {
    this.value = password;
    this.isHashed = isHashed;
  }

  static create(password: string): Password {
    if (!password || password.length < 8) {
      throw new Error('validation.user.password_min');
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error('validation.user.password_uppercase');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('validation.user.password_number');
    }

    return new Password(password, false);
  }

  static fromHashed(hashedPassword: string): Password {
    return new Password(hashedPassword, true);
  }

  toString(): string {
    return this.value;
  }

  isAlreadyHashed(): boolean {
    return this.isHashed;
  }
}

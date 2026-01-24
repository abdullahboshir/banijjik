export class Phone {
  private readonly value: string;

  private constructor(phone: string) {
    this.value = phone;
  }

  static create(phone: string): Phone {
    if (!phone || phone.trim().length === 0) {
      throw new Error('validation.user.phone_required');
    }

    const phoneRegex = /^[+]?[\d\s-]{7,15}$/;
    const cleanPhone = phone.replace(/\s/g, '');

    if (!phoneRegex.test(cleanPhone)) {
      throw new Error('validation.user.phone_invalid');
    }

    return new Phone(cleanPhone);
  }

  static createOptional(phone: string | null | undefined): Phone | null {
    if (!phone || phone.trim().length === 0) {
      return null;
    }
    return Phone.create(phone);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}

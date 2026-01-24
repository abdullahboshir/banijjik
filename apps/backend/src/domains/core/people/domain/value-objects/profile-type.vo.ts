export class ProfileType {
  private constructor(private readonly value: string) {}

  static STUDENT = new ProfileType('STUDENT');
  static MEMBER = new ProfileType('MEMBER');
  static PATIENT = new ProfileType('PATIENT');
  static CUSTOMER = new ProfileType('CUSTOMER');
  static EMPLOYEE = new ProfileType('EMPLOYEE');
  static GUEST = new ProfileType('GUEST');

  static from(value: string): ProfileType {
    const allowed = Object.values(ProfileType)
      .filter(v => v instanceof ProfileType) as ProfileType[];

    const match = allowed.find(v => v.value === value);
    if (!match) {
      throw new Error(`Invalid ProfileType: ${value}`);
    }
    return match;
  }

  isGuest(): boolean {
    return this === ProfileType.GUEST;
  }

  toString() {
    return this.value;
  }
}

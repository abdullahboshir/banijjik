export class Email {
    constructor(email) {
        this.value = email.toLowerCase().trim();
    }
    static create(email) {
        if (!email || email.trim().length === 0) {
            throw new Error('validation.user.email_required');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('validation.user.email_invalid');
        }
        return new Email(email);
    }
    toString() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
//# sourceMappingURL=email.vo.js.map
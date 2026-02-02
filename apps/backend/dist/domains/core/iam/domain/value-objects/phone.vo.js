export class Phone {
    constructor(phone) {
        this.value = phone;
    }
    static create(phone) {
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
    static createOptional(phone) {
        if (!phone || phone.trim().length === 0) {
            return null;
        }
        return Phone.create(phone);
    }
    toString() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
//# sourceMappingURL=phone.vo.js.map
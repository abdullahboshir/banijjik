export class Password {
    constructor(password, isHashed) {
        this.value = password;
        this.isHashed = isHashed;
    }
    static create(password) {
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
    static fromHashed(hashedPassword) {
        return new Password(hashedPassword, true);
    }
    toString() {
        return this.value;
    }
    isAlreadyHashed() {
        return this.isHashed;
    }
}
//# sourceMappingURL=password.vo.js.map
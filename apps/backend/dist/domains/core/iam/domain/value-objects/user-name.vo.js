export class UserName {
    constructor(firstName, lastName) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
    static create(firstName, lastName) {
        if (!firstName || firstName.trim().length === 0) {
            throw new Error('validation.user.first_name_required');
        }
        if (firstName.length > 50) {
            throw new Error('validation.user.first_name_max');
        }
        if (lastName && lastName.length > 50) {
            throw new Error('validation.user.last_name_max');
        }
        return new UserName(firstName.trim(), lastName ? lastName.trim() : null);
    }
    getFirstName() {
        return this.firstName;
    }
    getLastName() {
        return this.lastName;
    }
    getFullName() {
        if (this.lastName) {
            return `${this.firstName} ${this.lastName}`;
        }
        return this.firstName;
    }
    toObject() {
        const obj = {
            firstName: this.firstName,
        };
        if (this.lastName) {
            obj.lastName = this.lastName;
        }
        return obj;
    }
    equals(other) {
        return (this.firstName === other.firstName && this.lastName === other.lastName);
    }
}
//# sourceMappingURL=user-name.vo.js.map
import * as bcrypt from 'bcrypt';
export class BcryptPasswordService {
    constructor() {
        this.saltRounds = 10;
    }
    async hash(password) {
        return bcrypt.hash(password, this.saltRounds);
    }
    async compare(plain, hashed) {
        return bcrypt.compare(plain, hashed);
    }
}
//# sourceMappingURL=bcrypt-password.service.js.map
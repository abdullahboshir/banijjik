export class UniqueEmailPolicy {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async isSatisfiedBy(email) {
        const user = await this.userRepository.findByEmail(email);
        return !user;
    }
}
//# sourceMappingURL=unique-email.policy.js.map
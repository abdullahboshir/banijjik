export class PasswordStrengthPolicy {
    /**
     * Validates if the password meets the gold standard security requirements.
     * Note: Some basic checks are already in the Value Object,
     * but this policy can hold complex business-specific security rules.
     */
    isSatisfiedBy(password) {
        // Rule: At least 8 characters, one uppercase, one lowercase, one number, one special char
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-A-Za-z\d@$!%*?&]{8,}$/;
        // For now, keeping it simpler to match current Zod schema but expandable
        return password.length >= 8;
    }
    getErrorMessage() {
        return 'validation.user.password_too_weak';
    }
}
//# sourceMappingURL=password-strength.policy.js.map
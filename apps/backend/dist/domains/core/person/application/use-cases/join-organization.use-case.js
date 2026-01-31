import { Person } from "../../domain";
export class JoinOrganizationUseCase {
    constructor(personRepo) {
        this.personRepo = personRepo;
    }
    async execute(request) {
        // 1. Check if person exists
        let person = await this.personRepo.findByUserId(request.userId);
        // 2. If not, create new Person
        if (!person) {
            person = Person.create({
                userId: request.userId,
                // Map other fields from request
                firstName: request.firstName,
                lastName: request.lastName,
                email: request.email,
                status: "active", // Should use enum
            });
            await this.personRepo.save(person);
        }
        // 3. Logic for joining organization (which might involve OrganizationMembership service)
        // For now, returning success as this is the use-case structure
        return { success: true, personId: person.id };
    }
}
//# sourceMappingURL=join-organization.use-case.js.map
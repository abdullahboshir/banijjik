import { PersonRepository } from "../../domain";
import { JoinOrganizationSchema } from "@banijjik/validation";
import { z } from "zod";
type JoinRequest = z.infer<typeof JoinOrganizationSchema>;
export declare class JoinOrganizationUseCase {
    private readonly personRepo;
    constructor(personRepo: PersonRepository);
    execute(request: JoinRequest): Promise<any>;
}
export {};
//# sourceMappingURL=join-organization.use-case.d.ts.map
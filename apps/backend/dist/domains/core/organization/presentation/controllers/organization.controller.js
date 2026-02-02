export class OrganizationController {
    constructor(createOrganizationUseCase) {
        this.createOrganizationUseCase = createOrganizationUseCase;
    }
    async create(req, res) {
        try {
            const dto = req.body;
            // TODO: Validate body with Zod Middleware before here
            const result = await this.createOrganizationUseCase.execute(dto);
            res.status(201).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            console.error("Create Org Error:", error);
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
}
//# sourceMappingURL=organization.controller.js.map
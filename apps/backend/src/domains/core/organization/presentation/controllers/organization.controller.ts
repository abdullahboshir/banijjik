import { Request, Response } from "express";
import { CreateOrganizationUseCase } from "../../application/use-cases/create-organization.use-case";
import { CreateOrganizationDto } from "../../application/dto/create-organization.dto";

export class OrganizationController {
  constructor(
    private readonly createOrganizationUseCase: CreateOrganizationUseCase,
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const dto: CreateOrganizationDto = req.body;
      // TODO: Validate body with Zod Middleware before here

      const result = await this.createOrganizationUseCase.execute(dto);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("Create Org Error:", error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

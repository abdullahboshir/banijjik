import { Request, Response } from 'express';
import { JoinOrganizationUseCase, JoinOrganizationSchema } from '@people/application';
import { createSuccessResponse, ValidationError } from '@shared';

export class PeopleController {
  constructor(
    private readonly joinOrgUseCase: JoinOrganizationUseCase
  ) {}

  /**
   * Register or Look up a person and join them to an organization
   */
  async joinOrganization(req: Request, res: Response): Promise<void> {
    // 1. Validate Input
    const result = JoinOrganizationSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError('Invalid join request', result.error.format());
    }

    // 2. Execute Use Case
    const response = await this.joinOrgUseCase.execute(result.data);

    // 3. Return Standardized Response
    res.status(201).json(createSuccessResponse(response));
  }
}

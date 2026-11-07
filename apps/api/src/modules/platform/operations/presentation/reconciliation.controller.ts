import type { Request, Response } from "express";
import type {
  PlatformReconciliationQuery,
  PlatformReconciliationRunBody,
} from "@banijjik/contracts";
import type { RunReconciliationUseCase } from "../application/use-cases/run-reconciliation.use-case.js";

export class ReconciliationController {
  constructor(private readonly runReconciliationUseCase: RunReconciliationUseCase) {}

  readonly getReconciliation = async (request: Request, response: Response): Promise<void> => {
    const query = request.query as unknown as PlatformReconciliationQuery;
    const result = await this.runReconciliationUseCase.execute({ query });
    response.status(200).json({ success: true, data: result });
  };

  readonly runReconciliation = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as unknown as PlatformReconciliationRunBody;
    const result = await this.runReconciliationUseCase.execute({
      query: body,
      updateCursor: true,
    });
    response.status(200).json({ success: true, data: result });
  };
}

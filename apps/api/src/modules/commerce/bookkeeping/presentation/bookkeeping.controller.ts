import type { Request, Response } from "express";
import { respondSuccess } from "../../../../kernel/api/index.js";
import type { CreateAccountUseCase } from "../application/use-cases/create-account.use-case.js";
import type { UpdateAccountUseCase } from "../application/use-cases/update-account.use-case.js";
import type { PostManualEntryUseCase } from "../application/use-cases/post-manual-entry.use-case.js";
import type { ReverseEntryUseCase } from "../application/use-cases/reverse-entry.use-case.js";
import type { ProfitAndLossUseCase } from "../application/use-cases/profit-and-loss.use-case.js";
import type { BalanceSheetUseCase } from "../application/use-cases/balance-sheet.use-case.js";

export interface BookkeepingControllerDeps {
  readonly createAccount: CreateAccountUseCase;
  readonly updateAccount: UpdateAccountUseCase;
  readonly postManualEntry: PostManualEntryUseCase;
  readonly reverseEntry: ReverseEntryUseCase;
  readonly profitAndLoss: ProfitAndLossUseCase;
  readonly balanceSheet: BalanceSheetUseCase;
}

export class BookkeepingController {
  constructor(private readonly deps: BookkeepingControllerDeps) {}

  async createAccount(req: Request, res: Response): Promise<void> {
    const result = await this.deps.createAccount.execute({
      organizationId: req.ctx.organization.organizationId,
      name: req.body.name,
      accountType: req.body.accountType,
      parentAccountCode: req.body.parentAccountCode,
      actorUserId: req.ctx.actorUserId,
    });
    respondSuccess(res, result);
  }

  async updateAccount(req: Request, res: Response): Promise<void> {
    const result = await this.deps.updateAccount.execute({
      organizationId: req.ctx.organization.organizationId,
      accountId: req.params.accountId,
      version: req.body.version,
      name: req.body.name,
      status: req.body.status,
      actorUserId: req.ctx.actorUserId,
    });
    respondSuccess(res, result);
  }

  async postManualEntry(req: Request, res: Response): Promise<void> {
    const result = await this.deps.postManualEntry.execute({
      organizationId: req.ctx.organization.organizationId,
      businessDate: req.body.businessDate,
      locationId: req.body.locationId,
      memo: req.body.memo,
      lines: req.body.lines,
      actorUserId: req.ctx.actorUserId,
    });
    respondSuccess(res, result);
  }

  async reverseEntry(req: Request, res: Response): Promise<void> {
    const result = await this.deps.reverseEntry.execute({
      organizationId: req.ctx.organization.organizationId,
      journalEntryId: req.params.journalEntryId,
      businessDate: req.body.businessDate,
      actorUserId: req.ctx.actorUserId,
    });
    respondSuccess(res, result);
  }

  async profitAndLoss(req: Request, res: Response): Promise<void> {
    const result = await this.deps.profitAndLoss.execute({
      organizationId: req.ctx.organization.organizationId,
      from: req.query.from as string,
      to: req.query.to as string,
      locationId: req.query.locationId as string | undefined,
    });
    respondSuccess(res, result);
  }

  async balanceSheet(req: Request, res: Response): Promise<void> {
    const result = await this.deps.balanceSheet.execute({
      organizationId: req.ctx.organization.organizationId,
      asOf: req.query.asOf as string,
    });
    respondSuccess(res, result);
  }
}

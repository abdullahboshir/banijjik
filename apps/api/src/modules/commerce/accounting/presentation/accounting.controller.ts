import type { JournalListQuery, TrialBalanceQuery } from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { GetTrialBalanceUseCase } from "../application/use-cases/get-trial-balance.use-case.js";
import type { ListAccountsUseCase } from "../application/use-cases/list-accounts.use-case.js";
import type { ListJournalUseCase } from "../application/use-cases/list-journal.use-case.js";

export interface AccountingControllerDependencies {
  readonly listAccounts: ListAccountsUseCase;
  readonly listJournal: ListJournalUseCase;
  readonly getTrialBalance: GetTrialBalanceUseCase;
}

function readJournalQuery(response: Response): JournalListQuery {
  return response.locals["validated"].query as JournalListQuery;
}

function readTrialBalanceQuery(response: Response): TrialBalanceQuery {
  return response.locals["validated"].query as TrialBalanceQuery;
}

export class AccountingController {
  constructor(private readonly dependencies: AccountingControllerDependencies) {}

  readonly listAccounts: RequestHandler = async (_request, response) => {
    sendData(response, await this.dependencies.listAccounts.execute());
  };

  readonly listJournal: RequestHandler = async (_request, response) => {
    const query = readJournalQuery(response);
    const result = await this.dependencies.listJournal.execute(query);
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly trialBalance: RequestHandler = async (_request, response) => {
    const { asOf } = readTrialBalanceQuery(response);
    sendData(response, await this.dependencies.getTrialBalance.execute(asOf));
  };
}

import type {
  AccountListQuery,
  AccountCreateBody,
  AccountUpdateBody,
  ManualJournalEntryBody,
  ReverseEntryBody,
  ProfitAndLossQuery,
  BalanceSheetQuery,
  JournalListQuery,
} from "@banijjik/validation/accounting";
import { asId, type AccountId, type JournalEntryId } from "@banijjik/ids";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { withTransaction } from "../../../../kernel/db/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  CreateAccountUseCase,
  UpdateAccountUseCase,
  PostManualEntryUseCase,
  ReverseEntryUseCase,
  ProfitAndLossUseCase,
  BalanceSheetUseCase,
  ListBookkeepingAccountsUseCase,
  ListJournalUseCase,
  GetTrialBalanceUseCase,
} from "../../accounting/index.js";
export interface BookkeepingControllerDeps {
  readonly createAccount: CreateAccountUseCase;
  readonly updateAccount: UpdateAccountUseCase;
  readonly postManualEntry: PostManualEntryUseCase;
  readonly reverseEntry: ReverseEntryUseCase;
  readonly profitAndLoss: ProfitAndLossUseCase;
  readonly balanceSheet: BalanceSheetUseCase;
  readonly listAccounts: ListBookkeepingAccountsUseCase;
  readonly listJournal: ListJournalUseCase;
  readonly trialBalance: GetTrialBalanceUseCase;
}
export class BookkeepingController {
  constructor(private readonly deps: BookkeepingControllerDeps) {}
  readonly createAccount: RequestHandler = async (request, response) => {
    const body: AccountCreateBody = request.body;
    sendData(
      response,
      await withTransaction(() =>
        this.deps.createAccount.execute({ ...readTenantCaller(), ...body }),
      ),
      { status: 201 },
    );
  };
  readonly updateAccount: RequestHandler = async (request, response) => {
    const body: AccountUpdateBody = request.body;
    sendData(
      response,
      await withTransaction(() =>
        this.deps.updateAccount.execute({
          ...readTenantCaller(),
          ...body,
          accountId: asId<AccountId>(String(request.params["accountId"])),
        }),
      ),
    );
  };
  readonly postManualEntry: RequestHandler = async (request, response) => {
    const body: ManualJournalEntryBody = request.body;
    sendData(
      response,
      await this.deps.postManualEntry.execute({
        ...readTenantCaller(),
        ...body,
        idempotencyKey: request.get("Idempotency-Key") ?? "",
      }),
    );
  };
  readonly reverseEntry: RequestHandler = async (request, response) => {
    const body: ReverseEntryBody = request.body;
    sendData(
      response,
      await this.deps.reverseEntry.execute({
        ...readTenantCaller(),
        ...body,
        journalEntryId: asId<JournalEntryId>(String(request.params["journalEntryId"])),
      }),
    );
  };
  readonly profitAndLoss: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as ProfitAndLossQuery;
    sendData(response, await this.deps.profitAndLoss.execute({ ...readTenantCaller(), ...query }));
  };
  readonly balanceSheet: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as BalanceSheetQuery;
    sendData(response, await this.deps.balanceSheet.execute({ ...readTenantCaller(), ...query }));
  };
  readonly listAccounts: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as AccountListQuery;
    const result = await this.deps.listAccounts.execute(query);
    sendData(response, result.items, { meta: { ...query, hasNext: result.hasNext } });
  };
  readonly listJournal: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as JournalListQuery;
    const result = await this.deps.listJournal.execute(query);
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };
  readonly trialBalance: RequestHandler = async (_request, response) => {
    const query = response.locals["validated"].query as BalanceSheetQuery;
    sendData(response, await this.deps.trialBalance.execute(query.asOf));
  };
}

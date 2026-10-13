import type { UserStatus } from "@banijjik/contracts";
import type { PlatformOperatorRepository } from "../ports/platform-operator-repository.js";
import type { UserRepository } from "../ports/user-repository.js";
import { summariesOf, type OperatorSummarySource } from "./operator-summary.js";

export interface ListPlatformOperatorsQuery {
  readonly status?: UserStatus;
  readonly page: number;
  readonly limit: number;
}

export interface ListPlatformOperatorsDependencies {
  readonly operators: Pick<PlatformOperatorRepository, "list">;
  readonly users: Pick<UserRepository, "findByIds">;
}

/** The operator list, newest first, with one user read for the page. */
export class ListPlatformOperatorsUseCase {
  constructor(private readonly dependencies: ListPlatformOperatorsDependencies) {}

  async execute(
    query: ListPlatformOperatorsQuery,
  ): Promise<{ items: readonly OperatorSummarySource[]; hasNext: boolean }> {
    const page = await this.dependencies.operators.list(query);
    return { items: await summariesOf(page.items, this.dependencies.users), hasNext: page.hasNext };
  }
}

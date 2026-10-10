import type { UserId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { PlatformOperatorRepository } from "../application/ports/platform-operator-repository.js";
import type { PlatformOperator } from "../domain/platform-operator.entity.js";
import { toPlatformOperator, toPlatformOperatorDocument } from "./platform-operator.mapper.js";
import {
  PLATFORM_OPERATOR_MODEL_NAME,
  type PlatformOperatorDocument,
} from "./platform-operator.schema.js";

export class MongoPlatformOperatorRepository implements PlatformOperatorRepository {
  async findByUserId(userId: UserId): Promise<PlatformOperator | undefined> {
    const document = await this.model()
      .findOne({ userId }, null, sessionOption(getActiveSession()))
      .lean<PlatformOperatorDocument>();
    return document === null ? undefined : toPlatformOperator(document);
  }

  async insert(operator: PlatformOperator): Promise<void> {
    await this.model().create(
      [toPlatformOperatorDocument(operator)],
      sessionOption(getActiveSession()),
    );
  }

  private model() {
    return models({}).get<PlatformOperatorDocument>(PLATFORM_OPERATOR_MODEL_NAME);
  }
}

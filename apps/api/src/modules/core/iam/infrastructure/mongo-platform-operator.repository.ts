import type { UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  PlatformOperatorListQuery,
  PlatformOperatorPage,
  PlatformOperatorRepository,
} from "../application/ports/platform-operator-repository.js";
import type { PlatformOperator } from "../domain/platform-operator.entity.js";
import { toPlatformOperator, toPlatformOperatorDocument } from "./platform-operator.mapper.js";
import {
  PLATFORM_OPERATOR_MODEL_NAME,
  type PlatformOperatorDocument,
} from "./platform-operator.schema.js";

export class MongoPlatformOperatorRepository implements PlatformOperatorRepository {
  async findByUserId(userId: UserId): Promise<PlatformOperator | undefined> {
    return this.findOne({ userId });
  }

  async findById(platformOperatorId: string): Promise<PlatformOperator | undefined> {
    return this.findOne({ platformOperatorId });
  }

  async list(query: PlatformOperatorListQuery): Promise<PlatformOperatorPage> {
    const rows = await this.model()
      .find(query.status === undefined ? {} : { status: query.status })
      .sort({ createdAt: -1, platformOperatorId: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<PlatformOperatorDocument[]>();
    return {
      items: rows.slice(0, query.limit).map(toPlatformOperator),
      hasNext: rows.length > query.limit,
    };
  }

  async touch(platformOperatorId: string): Promise<PlatformOperator | undefined> {
    // referenceVersion is the guard counter (ADR-092): it must not bump version or updatedAt.
    const document = await this.model()
      .findOneAndUpdate(
        { platformOperatorId },
        { $inc: { referenceVersion: 1 } },
        { returnDocument: "after", timestamps: false, ...sessionOption(getActiveSession()) },
      )
      .lean<PlatformOperatorDocument>();
    return document === null ? undefined : toPlatformOperator(document);
  }

  async insert(operator: PlatformOperator, actorUserId?: UserId): Promise<void> {
    await this.model().create(
      [toPlatformOperatorDocument(operator, actorUserId)],
      sessionOption(getActiveSession()),
    );
  }

  async save(
    operator: PlatformOperator,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<PlatformOperator> {
    const saved = await updateVersioned<PlatformOperatorDocument>({
      model: this.model(),
      filter: { platformOperatorId: operator.platformOperatorId },
      expectedVersion,
      update: {
        $set: {
          platformRoles: [...operator.platformRoles],
          status: operator.status,
          updatedByUserId: actorUserId,
        },
      },
    });
    return toPlatformOperator(saved);
  }

  private async findOne(
    filter: { userId: string } | { platformOperatorId: string },
  ): Promise<PlatformOperator | undefined> {
    const document = await this.model()
      .findOne(filter, null, sessionOption(getActiveSession()))
      .lean<PlatformOperatorDocument>();
    return document === null ? undefined : toPlatformOperator(document);
  }

  private model() {
    return models({}).get<PlatformOperatorDocument>(PLATFORM_OPERATOR_MODEL_NAME);
  }
}

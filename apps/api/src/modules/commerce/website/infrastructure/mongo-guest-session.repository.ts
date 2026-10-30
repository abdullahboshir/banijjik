import type { GuestSessionEntity } from "@banijjik/contracts/website";
import { models } from "../../../../kernel/db/index.js";
import type {
  GuestSessionRepository,
  UpdateGuestSessionProvisionalContactInput,
} from "../application/ports/guest-session-repository.port.js";
import { GUEST_SESSION_MODEL_NAME, type GuestSessionDocument } from "./guest-session.schema.js";

function toEntity(doc: GuestSessionDocument): GuestSessionEntity {
  return {
    guestSessionId: doc.guestSessionId,
    organizationId: doc.organizationId,
    secretHash: doc.secretHash,
    expiresAt: doc.expiresAt,
    provisionalContactId: doc.provisionalContactId ?? null,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoGuestSessionRepository implements GuestSessionRepository {
  private model() {
    return models({}).get<GuestSessionDocument>(GUEST_SESSION_MODEL_NAME);
  }

  async findById(
    organizationId: string,
    guestSessionId: string,
  ): Promise<GuestSessionEntity | null> {
    const doc = await this.model()
      .findOne({ organizationId, guestSessionId })
      .lean<GuestSessionDocument>();
    return doc ? toEntity(doc) : null;
  }

  async findBySessionId(guestSessionId: string): Promise<GuestSessionEntity | null> {
    const doc = await this.model().findOne({ guestSessionId }).lean<GuestSessionDocument>();
    return doc ? toEntity(doc) : null;
  }

  async create(entity: GuestSessionEntity): Promise<void> {
    await this.model().create({
      guestSessionId: entity.guestSessionId,
      organizationId: entity.organizationId,
      secretHash: entity.secretHash,
      expiresAt: entity.expiresAt,
      provisionalContactId: entity.provisionalContactId,
      version: entity.version,
    });
  }

  async updateProvisionalContact(
    input: UpdateGuestSessionProvisionalContactInput,
  ): Promise<boolean> {
    const { organizationId, guestSessionId, provisionalContactId, expectedVersion } = input;
    const res = await this.model().updateOne(
      { organizationId, guestSessionId, version: expectedVersion },
      {
        $set: { provisionalContactId },
        $inc: { version: 1 },
      },
    );
    return res.modifiedCount === 1;
  }
}

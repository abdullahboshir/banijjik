import { newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { InMemoryUserRepository } from "../../../../../test-support/iam-fakes.js";
import { User } from "../../domain/user.entity.js";
import { ReadUserProfileUseCase } from "./read-user-profile.use-case.js";

describe("ReadUserProfileUseCase", () => {
  it("returns only the display name and the language of a user", async () => {
    const users = new InMemoryUserRepository();
    const user = User.create({
      name: "Rahim Uddin",
      email: "rahim@example.com",
      passwordHash: "stored-hash",
      preferredLocale: "en",
      now: new Date("2026-10-11T08:00:00.000Z"),
    });
    await users.insert(user);

    const profile = await new ReadUserProfileUseCase({ users }).execute({ userId: user.userId });

    expect(profile).toEqual({ name: "Rahim Uddin", preferredLocale: "en" });
  });

  it("returns nothing for a user that does not exist", async () => {
    const useCase = new ReadUserProfileUseCase({ users: new InMemoryUserRepository() });

    expect(await useCase.execute({ userId: newId() as UserId })).toBeUndefined();
  });
});

import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "../application/ports/password-hasher.js";

// OWASP Password Storage Cheat Sheet, argon2id minimum: 19 MiB memory, 2 iterations, 1 lane.
const MEMORY_COST_KIB = 19_456;
const TIME_COST = 2;
const PARALLELISM = 1;

/** argon2id (the package default algorithm) through prebuilt binaries; the salt is random per hash. */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, {
      memoryCost: MEMORY_COST_KIB,
      timeCost: TIME_COST,
      parallelism: PARALLELISM,
    });
  }

  verify(hashValue: string, password: string): Promise<boolean> {
    return verify(hashValue, password);
  }
}

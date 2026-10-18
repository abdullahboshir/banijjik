import { isUuidV7 } from "./is-uuid-v7.js";

/** A UUID v7 string tagged with the entity it identifies, so a UserId cannot be passed as a LocationId. */
export type Id<EntityName extends string> = string & { readonly __brand: EntityName };

export type UserId = Id<"User">;
export type OrganizationId = Id<"Organization">;
export type LocationId = Id<"Location">;
export type MemberId = Id<"Member">;
export type ContactId = Id<"Contact">;
export type CustomerAccountId = Id<"CustomerAccount">;
export type CustomerSessionId = Id<"CustomerSession">;
export type OtpChallengeId = Id<"OtpChallenge">;
export type OfferingId = Id<"Offering">;
export type CategoryId = Id<"Category">;
export type ModifierGroupId = Id<"ModifierGroup">;
export type RoleId = Id<"Role">;
export type InvitationId = Id<"Invitation">;
export type PackageId = Id<"Package">;
export type PlatformSubscriptionId = Id<"PlatformSubscription">;
export type ModuleOverrideId = Id<"ModuleOverride">;
export type IndustryTemplateId = Id<"IndustryTemplate">;

export class InvalidIdError extends Error {
  constructor() {
    super("ids.invalid_uuid_v7");
    this.name = "InvalidIdError";
  }
}

/** Narrows a validated string to a branded ID. Throws InvalidIdError when it is not a UUID v7. */
export function asId<IdType extends Id<string>>(value: string): IdType {
  if (!isUuidV7(value)) throw new InvalidIdError();
  // Safe: the brand exists only at type level and the value was just validated.
  return value as IdType;
}

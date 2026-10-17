import { CONTACT_NAME_MAX_LENGTH } from "@banijjik/contracts/contact";
import { z } from "zod";
import { phoneE164Schema } from "../phone.js";

/**
 * The `{ create }` input of a contact-link field (ADR-073): the server links the active contact with
 * this phone or creates one. The phone comes out as E.164. The value stored in the entity is always
 * the linked `contactId`; this shape exists only in requests.
 */
export const contactLinkCreateSchema = z.strictObject({
  create: z.strictObject({
    name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH),
    phone: phoneE164Schema,
  }),
});

export type ContactLinkCreateValue = z.output<typeof contactLinkCreateSchema>;

import { describe, expect, it } from "vitest";
import { CONTACT_EVENT_TYPE } from "../contact/contact-event-type.js";
import { CUSTOM_FIELD_EVENT_TYPE } from "../custom-field/custom-field-event-type.js";
import { IAM_EVENT_TYPE } from "../iam/iam-event-type.js";
import { ORGANIZATION_EVENT_TYPE } from "../organization/organization-event-type.js";
import { SETTINGS_EVENT_TYPE } from "../settings/settings-event-type.js";
import { EVENT_TYPE } from "./event-type.js";
import { OUTBOX_STATUS } from "./outbox-status.js";

// The module segment is kebab-case, so `custom-field` is a legal event name (card 2.3).
const EVENT_NAME_PATTERN = /^[a-z][a-z0-9-]*\.[a-z]+\.[a-z][A-Za-z]*(ed|d)$/;

describe("event types", () => {
  it("contains every module event exactly once", () => {
    const expected = [
      ...Object.values(IAM_EVENT_TYPE),
      ...Object.values(ORGANIZATION_EVENT_TYPE),
      ...Object.values(CUSTOM_FIELD_EVENT_TYPE),
      ...Object.values(SETTINGS_EVENT_TYPE),
      ...Object.values(CONTACT_EVENT_TYPE),
    ].sort();

    expect(Object.values(EVENT_TYPE).sort()).toEqual(expected);
    expect(new Set(Object.values(EVENT_TYPE)).size).toBe(expected.length);
  });

  it("names every event <module>.<entity>.<pastTenseVerb>", () => {
    for (const type of Object.values(EVENT_TYPE)) expect(type).toMatch(EVENT_NAME_PATTERN);
  });

  it("declares the three role events of 09 section 4.5 with archived instead of deleted", () => {
    expect(IAM_EVENT_TYPE.ROLE_CREATED).toBe("iam.role.created");
    expect(IAM_EVENT_TYPE.ROLE_PERMISSIONS_CHANGED).toBe("iam.role.permissionsChanged");
    expect(IAM_EVENT_TYPE.ROLE_ARCHIVED).toBe("iam.role.archived");
  });
});

describe("outbox status", () => {
  it("has the three states of an outbox event", () => {
    expect(Object.values(OUTBOX_STATUS)).toEqual(["PENDING", "DISPATCHED", "DEAD"]);
  });
});

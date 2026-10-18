import { EVENT_TYPE, MODULE_KEY, type EventType } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { AppError } from "../http/app-error.js";
import { EventHandlerRegistry, type EventHandler } from "./event-handler-registry.js";

function aHandler(
  handlerKey: string,
  eventType: EventType = EVENT_TYPE.USER_REGISTERED,
): EventHandler {
  return {
    handlerKey,
    moduleKey: MODULE_KEY.IAM,
    eventType,
    ordering: "UNORDERED",
    handle: async () => undefined,
  };
}

describe("EventHandlerRegistry", () => {
  it("finds a handler by key and lists the handlers of an event type", () => {
    const registry = new EventHandlerRegistry();
    const welcome = aHandler("notification.welcome");
    const audit = aHandler("audit.userRegistered");
    registry.register(welcome);
    registry.register(audit);
    registry.register(aHandler("audit.roleCreated", EVENT_TYPE.ROLE_CREATED));

    expect(registry.find("notification.welcome")).toBe(welcome);
    expect(registry.handlersFor(EVENT_TYPE.USER_REGISTERED)).toEqual([welcome, audit]);
    expect(registry.handlersFor(EVENT_TYPE.MEMBER_JOINED)).toEqual([]);
    expect(registry.find("unknown.handler")).toBeUndefined();
  });

  it("throws when a handler key is registered twice", () => {
    const registry = new EventHandlerRegistry();
    registry.register(aHandler("notification.welcome"));

    expect(() => registry.register(aHandler("notification.welcome"))).toThrow(AppError);
    expect(() => registry.register(aHandler("notification.welcome"))).toThrow(
      /duplicate_event_handler/,
    );
  });

  it("throws when a handler is registered after the registry was sealed at start", () => {
    const registry = new EventHandlerRegistry();
    registry.register(aHandler("notification.welcome"));
    registry.seal();

    expect(() => registry.register(aHandler("audit.userRegistered"))).toThrow(
      /event_handler_registry_sealed/,
    );
    expect(registry.find("notification.welcome")).toBeDefined();
  });

  it.each(["welcome", "has:colon.handler", "Upper.case", "module..purpose", "1module.purpose"])(
    "rejects the handler key %s, which is not <module>.<purpose> and safe as a job id",
    (handlerKey) => {
      expect(() => new EventHandlerRegistry().register(aHandler(handlerKey))).toThrow(
        /invalid_event_handler_key/,
      );
    },
  );
});

import { EVENT_TYPE, MODULE_KEY, type EventType } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { AppError } from "../http/app-error.js";
import { EventHandlerRegistry, type EventHandler } from "./event-handler-registry.js";

function aHandler(
  handlerKey: string,
  eventType: EventType = EVENT_TYPE.USER_REGISTERED,
): Extract<EventHandler, { ordering: "UNORDERED" }> {
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
    expect(registry.handlersFor({ type: EVENT_TYPE.USER_REGISTERED, orderingKey: null })).toEqual([
      welcome,
      audit,
    ]);
    expect(registry.handlersFor({ type: EVENT_TYPE.MEMBER_JOINED, orderingKey: null })).toEqual([]);
    expect(registry.find("unknown.handler")).toBeUndefined();
  });

  it("lists a handler for alsoHandles event types on a shared ORDERED stream", () => {
    const registry = new EventHandlerRegistry();
    const payments: EventHandler = {
      handlerKey: "accounting.postPayments",
      moduleKey: MODULE_KEY.ACCOUNTING,
      eventType: EVENT_TYPE.PAYMENT_RECEIVED,
      alsoHandles: [EVENT_TYPE.PAYMENT_REFUNDED, EVENT_TYPE.PAYMENT_REVERSED],
      ordering: "ORDERED",
      streamPrefixes: ["paymentAccount:"],
      handle: async () => undefined,
    };
    registry.register(payments);

    expect(registry.handlersFor({ type: EVENT_TYPE.PAYMENT_RECEIVED, orderingKey: null })).toEqual([
      payments,
    ]);
    expect(registry.handlersFor({ type: EVENT_TYPE.PAYMENT_REFUNDED, orderingKey: null })).toEqual([
      payments,
    ]);
    expect(registry.handlersFor({ type: EVENT_TYPE.PAYMENT_REVERSED, orderingKey: null })).toEqual([
      payments,
    ]);
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

function orderedHandler(streamPrefixes: readonly [string, ...string[]]): EventHandler {
  return { ...aHandler("ledger.post"), ordering: "ORDERED", streamPrefixes };
}

describe("declared ordered streams", () => {
  it("fans out unhandled types only to stream followers and never duplicates a handler", () => {
    const registry = new EventHandlerRegistry();
    const follower = orderedHandler(["booking:"]);
    const unordered = aHandler("audit.record");
    registry.register(follower);
    registry.register(unordered);
    expect(
      registry.handlersFor({ type: EVENT_TYPE.MEMBER_JOINED, orderingKey: "booking:one" }),
    ).toEqual([follower]);
    expect(
      registry.handlersFor({ type: EVENT_TYPE.MEMBER_JOINED, orderingKey: "order:one" }),
    ).toEqual([]);
    expect(registry.handlersFor({ type: EVENT_TYPE.MEMBER_JOINED, orderingKey: null })).toEqual([]);
    expect(
      registry.handlersFor({ type: EVENT_TYPE.USER_REGISTERED, orderingKey: "booking:one" }),
    ).toEqual([follower, unordered]);
    expect(registry.handlersFor({ type: EVENT_TYPE.USER_REGISTERED, orderingKey: null })).toEqual([
      follower,
      unordered,
    ]);
  });

  it.each(["Booking", "booking", ""])("refuses invalid stream prefix %s", (prefix) => {
    expect(() => new EventHandlerRegistry().register(orderedHandler([prefix]))).toThrow(
      /event_handler_invalid_stream/,
    );
  });

  it("refuses overlapping stream prefixes", () => {
    expect(() =>
      new EventHandlerRegistry().register(orderedHandler(["booking:", "booking:"])),
    ).toThrow(/event_handler_invalid_stream/);
  });

  it("requires nonempty stream prefixes only for ordered handlers at compile time", () => {
    const base = {
      handlerKey: "ledger.post",
      moduleKey: MODULE_KEY.IAM,
      eventType: EVENT_TYPE.USER_REGISTERED,
      handle: async () => undefined,
    };
    // @ts-expect-error ORDERED handlers must declare the streams they follow.
    const missing: EventHandler = { ...base, ordering: "ORDERED" };
    const empty: EventHandler = {
      ...base,
      ordering: "ORDERED",
      // @ts-expect-error An ordered handler must follow at least one stream.
      streamPrefixes: [],
    };
    // @ts-expect-error UNORDERED handlers cannot follow streams.
    const unordered: EventHandler = {
      ...base,
      ordering: "UNORDERED",
      streamPrefixes: ["booking:"] as const,
    };
    expect(missing.ordering).toBe("ORDERED");
    expect(() => new EventHandlerRegistry().register(empty)).toThrow(
      /event_handler_invalid_stream/,
    );
    expect(unordered.ordering).toBe("UNORDERED");
  });
});

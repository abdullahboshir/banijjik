import { EVENT_TYPE, MODULE_KEY, type ModuleKey } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publishTestEvent } from "../../test-support/event-fixtures.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../test-support/test-databases.js";
import { initializeModels, models } from "../db/index.js";
import type { DatabaseConnections } from "../db/database-connections.js";
import { EventHandlerRegistry } from "./event-handler-registry.js";
import type { EventJobData } from "./event-job.js";
import { runEventHandler } from "./handler-runner.js";
import type { ModuleEffectiveness } from "./module-effectiveness.js";
import { PROCESSED_EVENT_MODEL_NAME } from "./processed-event.schema.js";
import { registerEventModels } from "./register-event-models.js";

registerEventModels();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

interface ProbeHandler {
  readonly registry: EventHandlerRegistry;
  readonly calls: () => number;
}

function registryWithProbe(moduleKey: ModuleKey, handlerKey: string): ProbeHandler {
  let calls = 0;
  const registry = new EventHandlerRegistry();
  registry.register({
    handlerKey,
    moduleKey,
    eventType: EVENT_TYPE.USER_REGISTERED,
    ordering: "UNORDERED",
    handle: async () => void (calls += 1),
  });
  return { registry, calls: () => calls };
}

function jobFor(
  event: { eventId: string; type: string; organizationId: string | null },
  handlerKey: string,
): EventJobData {
  return {
    eventId: event.eventId,
    handlerKey,
    type: event.type,
    organizationId: event.organizationId,
  };
}

function effectiveness(isOn: boolean, asked: string[] = []): ModuleEffectiveness {
  return {
    isEffective: async (organizationId, moduleKey) => {
      asked.push(`${organizationId}:${moduleKey}`);
      return isOn;
    },
  };
}

function markerCount(eventId: string): Promise<number> {
  return models({}).get(PROCESSED_EVENT_MODEL_NAME).countDocuments({ eventId });
}

describe("runEventHandler and module effectiveness", () => {
  it("skips the handler of a module that is off for the organization and leaves no marker", async () => {
    const probe = registryWithProbe(MODULE_KEY.WORKFLOW, "workflow.probe");
    const event = await publishTestEvent(newId());

    const result = await runEventHandler(
      jobFor(event, "workflow.probe"),
      probe.registry,
      effectiveness(false),
    );

    expect(result).toBe("SKIPPED_MODULE_OFF");
    expect(probe.calls()).toBe(0);
    expect(await markerCount(event.eventId)).toBe(0);
  });

  it("runs the handler of a module that is on, asking about the event organization and the handler module", async () => {
    const probe = registryWithProbe(MODULE_KEY.WORKFLOW, "workflow.probeOn");
    const organizationId = newId();
    const event = await publishTestEvent(organizationId);
    const asked: string[] = [];

    const result = await runEventHandler(
      jobFor(event, "workflow.probeOn"),
      probe.registry,
      effectiveness(true, asked),
    );

    expect(result).toBe("HANDLED");
    expect(probe.calls()).toBe(1);
    expect(asked).toEqual([`${organizationId}:workflow`]);
  });

  it("always runs the handler of an event that belongs to no organization", async () => {
    const probe = registryWithProbe(MODULE_KEY.WORKFLOW, "workflow.userLevel");
    const event = await publishTestEvent(null);

    const result = await runEventHandler(
      jobFor(event, "workflow.userLevel"),
      probe.registry,
      effectiveness(false),
    );

    expect(result).toBe("HANDLED");
    expect(probe.calls()).toBe(1);
  });
});

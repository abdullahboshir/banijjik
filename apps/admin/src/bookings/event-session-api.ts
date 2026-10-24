import type { EventSessionCreateBody, EventSessionUpdateBody } from "@banijjik/validation/booking";
import { apiFetch } from "../lib/api/api-client";

export interface EventSessionView {
  eventSessionId: string;
  offeringId: string;
  variantId: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  seatsSold: number;
  status: string;
  version: number;
}
const base = (organizationId: string) => `/orgs/${organizationId}/event-sessions`;
export async function listEventSessions(
  organizationId: string,
  query = "",
): Promise<EventSessionView[]> {
  return (await apiFetch<EventSessionView[]>(`${base(organizationId)}?${query}`)).data;
}
export async function createEventSession(
  organizationId: string,
  body: EventSessionCreateBody,
): Promise<EventSessionView> {
  return (await apiFetch<EventSessionView>(base(organizationId), { method: "POST", body })).data;
}
export async function cancelEventSession(
  organizationId: string,
  eventSessionId: string,
  version: number,
): Promise<EventSessionView> {
  return (
    await apiFetch<EventSessionView>(`${base(organizationId)}/${eventSessionId}/cancel`, {
      method: "POST",
      body: { version },
    })
  ).data;
}
export async function updateEventSession(
  organizationId: string,
  eventSessionId: string,
  body: EventSessionUpdateBody,
): Promise<EventSessionView> {
  return (
    await apiFetch<EventSessionView>(`${base(organizationId)}/${eventSessionId}`, {
      method: "PATCH",
      body,
    })
  ).data;
}

import type {
  AvailabilitySlot,
  BookingResponse,
  ResourceResponse,
  ResourceTimeOffResponse,
} from "@banijjik/contracts/booking";
import type { BookingCancelBody, BookingCreateBody } from "@banijjik/validation/booking";
import { apiFetch } from "../lib/api/api-client";

function orgBase(organizationId: string): string {
  return `/orgs/${organizationId}`;
}

export async function listBookings(
  organizationId: string,
  query: string,
): Promise<BookingResponse[]> {
  const result = await apiFetch<BookingResponse[]>(`${orgBase(organizationId)}/bookings?${query}`);
  return result.data;
}

export async function getBooking(
  organizationId: string,
  bookingId: string,
): Promise<BookingResponse> {
  const result = await apiFetch<BookingResponse>(
    `${orgBase(organizationId)}/bookings/${bookingId}`,
  );
  return result.data;
}

export async function createBooking(
  organizationId: string,
  body: BookingCreateBody,
  idempotencyKey: string,
): Promise<BookingResponse> {
  const result = await apiFetch<BookingResponse>(`${orgBase(organizationId)}/bookings`, {
    method: "POST",
    body,
    idempotencyKey,
  });
  return result.data;
}

export async function transitionBooking(input: {
  organizationId: string;
  bookingId: string;
  action: string;
  body: Record<string, unknown>;
}): Promise<BookingResponse> {
  const result = await apiFetch<BookingResponse>(
    `${orgBase(input.organizationId)}/bookings/${input.bookingId}/${input.action}`,
    { method: "POST", body: input.body },
  );
  return result.data;
}

export async function cancelBooking(
  organizationId: string,
  bookingId: string,
  body: BookingCancelBody,
): Promise<BookingResponse> {
  return transitionBooking({ organizationId, bookingId, action: "cancel", body });
}

export async function listResources(
  organizationId: string,
  query: string,
): Promise<ResourceResponse[]> {
  const result = await apiFetch<ResourceResponse[]>(
    `${orgBase(organizationId)}/resources?${query}`,
  );
  return result.data;
}

export async function getResource(
  organizationId: string,
  resourceId: string,
): Promise<ResourceResponse> {
  const result = await apiFetch<ResourceResponse>(
    `${orgBase(organizationId)}/resources/${resourceId}`,
  );
  return result.data;
}

export async function listAvailability(
  organizationId: string,
  query: string,
): Promise<AvailabilitySlot[]> {
  const result = await apiFetch<AvailabilitySlot[]>(
    `${orgBase(organizationId)}/availability?${query}`,
  );
  return result.data;
}

export async function listResourceTimeOff(
  organizationId: string,
  resourceId: string,
): Promise<ResourceTimeOffResponse[]> {
  const result = await apiFetch<ResourceTimeOffResponse[]>(
    `${orgBase(organizationId)}/resources/${resourceId}/time-off`,
  );
  return result.data;
}

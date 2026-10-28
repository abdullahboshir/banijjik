import type {
  AvailabilityQuery,
  BookingCancelBody,
  BookingCreateBody,
  BookingHoldBody,
  BookingListQuery,
  BookingRescheduleBody,
  ResourceCreateBody,
  ResourceListQuery,
  ResourceTimeOffCreateBody,
  ResourceUpdateBody,
} from "@banijjik/validation/booking";
import type { RequestHandler, Response } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import { asId, type BookingId, type OrganizationId, type ResourceId } from "@banijjik/ids";
import type { CreateBookingUseCase } from "../application/use-cases/create-booking.use-case.js";
import type { GetAvailabilityUseCase } from "../application/use-cases/get-availability.use-case.js";
import type { HoldBookingUseCase } from "../application/use-cases/hold-booking.use-case.js";
import type { ListBookingsUseCase } from "../application/use-cases/list-bookings.use-case.js";
import type {
  ArchiveResourceUseCase,
  CreateResourceTimeOffUseCase,
  CreateResourceUseCase,
  GetResourceUseCase,
  ListResourceTimeOffUseCase,
  ListResourcesUseCase,
  UpdateResourceUseCase,
} from "../application/use-cases/resource.use-cases.js";
import type {
  CancelBookingUseCase,
  CheckInBookingUseCase,
  CompleteBookingUseCase,
  ConfirmBookingUseCase,
  GetBookingUseCase,
  NoShowBookingUseCase,
  RequestFromHoldUseCase,
  RescheduleBookingUseCase,
} from "../application/use-cases/transition-booking.use-cases.js";

const HTTP_CREATED = 201;

function validatedQuery<Query>(response: Response): Query {
  return response.locals["validated"].query as Query;
}

export class BookingController {
  constructor(
    private readonly useCases: {
      readonly getAvailability: GetAvailabilityUseCase;
      readonly listBookings: ListBookingsUseCase;
      readonly createBooking: CreateBookingUseCase;
      readonly holdBooking: HoldBookingUseCase;
      readonly getBooking: GetBookingUseCase;
      readonly confirmBooking: ConfirmBookingUseCase;
      readonly requestFromHold: RequestFromHoldUseCase;
      readonly checkInBooking: CheckInBookingUseCase;
      readonly completeBooking: CompleteBookingUseCase;
      readonly noShowBooking: NoShowBookingUseCase;
      readonly rescheduleBooking: RescheduleBookingUseCase;
      readonly cancelBooking: CancelBookingUseCase;
      readonly createResource: CreateResourceUseCase;
      readonly listResources: ListResourcesUseCase;
      readonly getResource: GetResourceUseCase;
      readonly updateResource: UpdateResourceUseCase;
      readonly listResourceTimeOff: ListResourceTimeOffUseCase;
      readonly createResourceTimeOff: CreateResourceTimeOffUseCase;
      readonly archiveResource: ArchiveResourceUseCase;
    },
  ) {}

  readonly availability: RequestHandler = async (request, response) => {
    const query = validatedQuery<AvailabilityQuery>(response);
    const { organizationId, allowedLocationIds } = readTenantCaller();
    const slots = await this.useCases.getAvailability.execute({
      organizationId: asId<OrganizationId>(organizationId),
      allowedLocationIds,
      query,
    });
    sendData(response, slots);
  };

  readonly list: RequestHandler = async (request, response) => {
    const query = validatedQuery<BookingListQuery>(response);
    const { organizationId, allowedLocationIds } = readTenantCaller();
    const page = await this.useCases.listBookings.execute({
      organizationId: asId<OrganizationId>(organizationId),
      allowedLocationIds,
      query,
    });
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly create: RequestHandler = async (request, response) => {
    const body = request.body as BookingCreateBody;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const created = await this.useCases.createBooking.execute({
      organizationId: asId<OrganizationId>(organizationId),
      actorUserId,
      allowedLocationIds,
      body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly hold: RequestHandler = async (request, response) => {
    const body = request.body as BookingHoldBody;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const created = await this.useCases.holdBooking.execute({
      organizationId: asId<OrganizationId>(organizationId),
      actorUserId,
      allowedLocationIds,
      body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly get: RequestHandler = async (request, response) => {
    const bookingId = asId<BookingId>(String(request.params.bookingId));
    sendData(response, await this.useCases.getBooking.execute(bookingId));
  };

  readonly confirm: RequestHandler = async (request, response) => {
    const body = request.body as { version: number };
    const { actorUserId, allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.useCases.confirmBooking.execute({
        bookingId: asId<BookingId>(String(request.params.bookingId)),
        version: body.version,
        actorUserId,
        allowedLocationIds,
      }),
    );
  };

  readonly requestFromHold: RequestHandler = async (request, response) => {
    const body = request.body as { version: number };
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.useCases.requestFromHold.execute({
        organizationId: asId<OrganizationId>(organizationId),
        bookingId: asId<BookingId>(String(request.params.bookingId)),
        version: body.version,
        actorUserId,
        allowedLocationIds,
      }),
    );
  };

  readonly checkIn: RequestHandler = async (request, response) => {
    const body = request.body as { version: number };
    const { actorUserId, allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.useCases.checkInBooking.execute({
        bookingId: asId<BookingId>(String(request.params.bookingId)),
        version: body.version,
        actorUserId,
        allowedLocationIds,
      }),
    );
  };

  readonly complete: RequestHandler = async (request, response) => {
    const body = request.body as { version: number };
    const { actorUserId, allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.useCases.completeBooking.execute({
        bookingId: asId<BookingId>(String(request.params.bookingId)),
        version: body.version,
        actorUserId,
        allowedLocationIds,
      }),
    );
  };

  readonly noShow: RequestHandler = async (request, response) => {
    const body = request.body as { version: number };
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.useCases.noShowBooking.execute({
        organizationId: asId<OrganizationId>(organizationId),
        bookingId: asId<BookingId>(String(request.params.bookingId)),
        version: body.version,
        actorUserId,
        allowedLocationIds,
      }),
    );
  };

  readonly reschedule: RequestHandler = async (request, response) => {
    const body = request.body as BookingRescheduleBody;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const updated = await this.useCases.rescheduleBooking.execute({
      organizationId: asId<OrganizationId>(organizationId),
      bookingId: asId<BookingId>(String(request.params.bookingId)),
      version: body.version,
      ...(body.startsAt === undefined ? {} : { startsAt: body.startsAt }),
      ...(body.eventSessionId === undefined ? {} : { eventSessionId: body.eventSessionId }),
      ...(body.resourceId === undefined ? {} : { resourceId: body.resourceId }),
      actorUserId,
      allowedLocationIds,
    });
    sendData(response, updated);
  };

  readonly cancel: RequestHandler = async (request, response) => {
    const body = request.body as BookingCancelBody;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const updated = await this.useCases.cancelBooking.execute({
      organizationId: asId<OrganizationId>(organizationId),
      bookingId: asId<BookingId>(String(request.params.bookingId)),
      version: body.version,
      reason: body.reason,
      actorUserId,
      allowedLocationIds,
    });
    sendData(response, updated);
  };

  readonly createResource: RequestHandler = async (request, response) => {
    const body = request.body as ResourceCreateBody;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const created = await this.useCases.createResource.execute({
      organizationId: asId<OrganizationId>(organizationId),
      actorUserId,
      allowedLocationIds,
      body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly listResources: RequestHandler = async (request, response) => {
    const query = validatedQuery<ResourceListQuery>(response);
    const page = await this.useCases.listResources.execute(query);
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly getResource: RequestHandler = async (request, response) => {
    const { allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.useCases.getResource.execute({
        resourceId: asId<ResourceId>(String(request.params.resourceId)),
        allowedLocationIds,
      }),
    );
  };

  readonly updateResource: RequestHandler = async (request, response) => {
    const body = request.body as ResourceUpdateBody;
    const { actorUserId, allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.useCases.updateResource.execute({
        resourceId: asId<ResourceId>(String(request.params.resourceId)),
        allowedLocationIds,
        actorUserId,
        body,
      }),
    );
  };

  readonly listResourceTimeOff: RequestHandler = async (request, response) => {
    const { allowedLocationIds } = readTenantCaller();
    sendData(
      response,
      await this.useCases.listResourceTimeOff.execute({
        resourceId: asId<ResourceId>(String(request.params.resourceId)),
        allowedLocationIds,
      }),
    );
  };

  readonly createResourceTimeOff: RequestHandler = async (request, response) => {
    const body = request.body as ResourceTimeOffCreateBody;
    const { actorUserId, allowedLocationIds } = readTenantCaller();
    const created = await this.useCases.createResourceTimeOff.execute({
      resourceId: asId<ResourceId>(String(request.params.resourceId)),
      allowedLocationIds,
      actorUserId,
      body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly archiveResource: RequestHandler = async (request, response) => {
    const body = request.body as { version: number };
    const { actorUserId, allowedLocationIds } = readTenantCaller();
    const updated = await this.useCases.archiveResource.execute({
      resourceId: asId<ResourceId>(String(request.params.resourceId)),
      version: body.version,
      actorUserId,
      allowedLocationIds,
    });
    sendData(response, updated);
  };
}

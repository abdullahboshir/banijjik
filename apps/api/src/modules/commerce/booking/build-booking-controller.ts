import type { ModuleManifest } from "@banijjik/contracts";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrgConfigService } from "../../platform/entitlement/index.js";
import { buildBookingSettingsReader } from "./application/booking-settings-reader.js";
import { CreateBookingUseCase } from "./application/use-cases/create-booking.use-case.js";
import {
  ArchiveResourceUseCase,
  CreateResourceTimeOffUseCase,
  CreateResourceUseCase,
  GetResourceUseCase,
  ListResourceTimeOffUseCase,
  ListResourcesUseCase,
  UpdateResourceUseCase,
} from "./application/use-cases/resource.use-cases.js";
import { GetAvailabilityUseCase } from "./application/use-cases/get-availability.use-case.js";
import { HoldBookingUseCase } from "./application/use-cases/hold-booking.use-case.js";
import { ListBookingsUseCase } from "./application/use-cases/list-bookings.use-case.js";
import {
  CancelBookingUseCase,
  CheckInBookingUseCase,
  CompleteBookingUseCase,
  ConfirmBookingUseCase,
  GetBookingUseCase,
  NoShowBookingUseCase,
  RequestFromHoldUseCase,
  RescheduleBookingUseCase,
} from "./application/use-cases/transition-booking.use-cases.js";
import type { ContactCreator, PriceQuoterPort } from "./application/ports/booking-context-ports.js";
import { buildBookingOfferingReader } from "./infrastructure/booking-catalog-adapter.js";
import {
  buildOrganizationTimezoneReader,
  buildResourceContextPorts,
} from "./infrastructure/booking-org-adapter.js";
import {
  MongoBookingRepository,
  MongoResourceRepository,
} from "./infrastructure/mongo-booking.repositories.js";
import { MongoResourceTimeOffRepository } from "./infrastructure/mongo-resource-timeoff.repository.js";
import { MongoResourceSlotUsageRepository } from "./infrastructure/mongo-slot-usage.repository.js";
import { BookingController } from "./presentation/booking.controller.js";

import type { DepositCheckPort, PaymentStatusReader } from "./application/ports/payment-ports.js";

type WiringInput = {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly quoter: PriceQuoterPort;
  readonly contacts: ContactCreator;
  readonly depositCheck?: DepositCheckPort;
  readonly paymentStatusReader?: PaymentStatusReader;
};

type BookingRepos = {
  bookings: MongoBookingRepository;
  resources: MongoResourceRepository;
  timeOff: MongoResourceTimeOffRepository;
  slots: MongoResourceSlotUsageRepository;
  unitOfWork: MongoUnitOfWork;
};

type AppointmentWiring = {
  input: WiringInput;
  repos: BookingRepos;
  settings: ReturnType<typeof buildBookingSettingsReader>;
  offerings: ReturnType<typeof buildBookingOfferingReader>;
  timeZoneReader: ReturnType<typeof buildOrganizationTimezoneReader>;
  timeOffPort: {
    listOverlapping(
      resourceId: import("@banijjik/ids").ResourceId,
      from: Date,
      to: Date,
    ): Promise<readonly { startsAt: Date; endsAt: Date }[]>;
  };
};

function bookingRepositories(): BookingRepos {
  return {
    bookings: new MongoBookingRepository(),
    resources: new MongoResourceRepository(),
    timeOff: new MongoResourceTimeOffRepository(),
    slots: new MongoResourceSlotUsageRepository(),
    unitOfWork: new MongoUnitOfWork(),
  };
}

function bookingShared(wiring: AppointmentWiring) {
  return {
    bookings: wiring.repos.bookings,
    resources: wiring.repos.resources,
    slots: wiring.repos.slots,
    unitOfWork: wiring.repos.unitOfWork,
    events: kernelEventPublisher,
    audit: wiring.input.audit,
    clock: wiring.input.clock,
    offerings: wiring.offerings,
  };
}

function bookingQueryUseCases(wiring: AppointmentWiring) {
  return {
    getAvailability: new GetAvailabilityUseCase({
      resources: wiring.repos.resources,
      slots: wiring.repos.slots,
      offerings: wiring.offerings,
      settings: wiring.settings,
      timeZone: wiring.timeZoneReader,
      timeOff: wiring.timeOffPort,
      clock: wiring.input.clock,
    }),
    listBookings: new ListBookingsUseCase({
      bookings: wiring.repos.bookings,
      timeZone: wiring.timeZoneReader,
    }),
    getBooking: new GetBookingUseCase(wiring.repos.bookings, wiring.input.paymentStatusReader),
  };
}

function bookingCreateUseCases(wiring: AppointmentWiring) {
  const shared = bookingShared(wiring);
  const createDeps = {
    ...shared,
    settings: wiring.settings,
    quoter: wiring.input.quoter,
    contacts: wiring.input.contacts,
    timeZone: wiring.timeZoneReader,
    timeOff: wiring.timeOffPort,
  };
  return {
    createBooking: new CreateBookingUseCase(createDeps),
    holdBooking: new HoldBookingUseCase(createDeps),
  };
}

function bookingLifecycleUseCases(wiring: AppointmentWiring) {
  const shared = bookingShared(wiring);
  const events = shared.events;
  return {
    confirmBooking: new ConfirmBookingUseCase({
      bookings: wiring.repos.bookings,
      unitOfWork: wiring.repos.unitOfWork,
      events,
      audit: wiring.input.audit,
      clock: wiring.input.clock,
      ...(wiring.input.depositCheck ? { depositCheck: wiring.input.depositCheck } : {}),
    }),
    requestFromHold: new RequestFromHoldUseCase({
      bookings: wiring.repos.bookings,
      unitOfWork: wiring.repos.unitOfWork,
      events,
      audit: wiring.input.audit,
      clock: wiring.input.clock,
      settings: wiring.settings,
    }),
    checkInBooking: new CheckInBookingUseCase({
      bookings: wiring.repos.bookings,
      unitOfWork: wiring.repos.unitOfWork,
      events,
      audit: wiring.input.audit,
      clock: wiring.input.clock,
    }),
    completeBooking: new CompleteBookingUseCase({
      bookings: wiring.repos.bookings,
      unitOfWork: wiring.repos.unitOfWork,
      events,
      audit: wiring.input.audit,
      clock: wiring.input.clock,
    }),
    noShowBooking: new NoShowBookingUseCase({
      bookings: wiring.repos.bookings,
      slots: wiring.repos.slots,
      unitOfWork: wiring.repos.unitOfWork,
      events,
      audit: wiring.input.audit,
      clock: wiring.input.clock,
    }),
  };
}

function bookingTransitionUseCases(wiring: AppointmentWiring) {
  const shared = bookingShared(wiring);
  return {
    rescheduleBooking: new RescheduleBookingUseCase(shared),
    cancelBooking: new CancelBookingUseCase(shared),
  };
}

function appointmentUseCases(wiring: AppointmentWiring) {
  return {
    ...bookingQueryUseCases(wiring),
    ...bookingCreateUseCases(wiring),
    ...bookingLifecycleUseCases(wiring),
    ...bookingTransitionUseCases(wiring),
  };
}

function resourceUseCases(
  input: WiringInput,
  repos: BookingRepos,
  context: ReturnType<typeof buildResourceContextPorts>,
) {
  const events = kernelEventPublisher;
  return {
    createResource: new CreateResourceUseCase({
      resources: repos.resources,
      unitOfWork: repos.unitOfWork,
      events,
      audit: input.audit,
      clock: input.clock,
      resourceTypes: context.resourceTypes,
      offerings: context.offerings,
      members: context.members,
    }),
    listResources: new ListResourcesUseCase(repos.resources),
    getResource: new GetResourceUseCase(repos.resources),
    updateResource: new UpdateResourceUseCase({
      resources: repos.resources,
      unitOfWork: repos.unitOfWork,
      events,
      audit: input.audit,
      clock: input.clock,
      offerings: context.offerings,
      members: context.members,
    }),
    listResourceTimeOff: new ListResourceTimeOffUseCase({
      resources: repos.resources,
      timeOff: repos.timeOff,
    }),
    createResourceTimeOff: new CreateResourceTimeOffUseCase({
      resources: repos.resources,
      timeOff: repos.timeOff,
      audit: input.audit,
      clock: input.clock,
    }),
    archiveResource: new ArchiveResourceUseCase({
      resources: repos.resources,
      unitOfWork: repos.unitOfWork,
      events,
      audit: input.audit,
      clock: input.clock,
    }),
  };
}

export function buildBookingController(input: WiringInput): BookingController {
  const repos = bookingRepositories();
  const wiring: AppointmentWiring = {
    input,
    repos,
    settings: buildBookingSettingsReader({
      orgConfig: input.orgConfig,
      manifests: input.manifests,
    }),
    offerings: buildBookingOfferingReader(),
    timeZoneReader: buildOrganizationTimezoneReader(),
    timeOffPort: {
      listOverlapping: (resourceId, from, to) =>
        repos.timeOff.listOverlapping({ resourceId, from, to }),
    },
  };
  const context = buildResourceContextPorts();
  return new BookingController({
    ...appointmentUseCases(wiring),
    ...resourceUseCases(input, repos, context),
  });
}

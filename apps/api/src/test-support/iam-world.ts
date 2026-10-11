import { SessionIssuer } from "../modules/core/iam/application/session-issuer.js";
import { EnsurePlatformAdminUseCase } from "../modules/core/iam/application/use-cases/ensure-platform-admin.use-case.js";
import { GetMeUseCase } from "../modules/core/iam/application/use-cases/get-me.use-case.js";
import { LoginUseCase } from "../modules/core/iam/application/use-cases/login.use-case.js";
import { LogoutAllUseCase } from "../modules/core/iam/application/use-cases/logout-all.use-case.js";
import { LogoutUseCase } from "../modules/core/iam/application/use-cases/logout.use-case.js";
import { RefreshSessionUseCase } from "../modules/core/iam/application/use-cases/refresh-session.use-case.js";
import {
  RegisterUserUseCase,
  type RegisterUserInput,
} from "../modules/core/iam/application/use-cases/register-user.use-case.js";
import { UpdateMeUseCase } from "../modules/core/iam/application/use-cases/update-me.use-case.js";
import {
  FakePasswordHasher,
  FakeTokenIssuer,
  InMemoryPlatformOperatorRepository,
  InMemoryRateLimiter,
  InMemoryRefreshSessionRepository,
  InMemoryUserRepository,
  PassThroughUnitOfWork,
  RecordingEventPublisher,
  RecordingSeededOperatorAudit,
} from "./iam-fakes.js";
import { MutableClock } from "./mutable-clock.js";
import { installTestLogger } from "./test-databases.js";

export const TEST_PASSWORD = "correct horse battery staple";

/** The iam use cases wired to in-memory fakes, for tests that need no database. */
export interface IamWorld {
  readonly clock: MutableClock;
  readonly users: InMemoryUserRepository;
  readonly sessions: InMemoryRefreshSessionRepository;
  readonly operators: InMemoryPlatformOperatorRepository;
  readonly seededOperatorAudit: RecordingSeededOperatorAudit;
  readonly hasher: FakePasswordHasher;
  readonly rateLimiter: InMemoryRateLimiter;
  readonly events: RecordingEventPublisher;
  readonly registerUser: RegisterUserUseCase;
  readonly login: LoginUseCase;
  readonly refreshSession: RefreshSessionUseCase;
  readonly logout: LogoutUseCase;
  readonly logoutAll: LogoutAllUseCase;
  readonly getMe: GetMeUseCase;
  readonly updateMe: UpdateMeUseCase;
  readonly ensurePlatformAdmin: EnsurePlatformAdminUseCase;
}

export function createIamWorld(): IamWorld {
  installTestLogger();
  const clock = new MutableClock();
  const users = new InMemoryUserRepository();
  const sessions = new InMemoryRefreshSessionRepository();
  const operators = new InMemoryPlatformOperatorRepository();
  const seededOperatorAudit = new RecordingSeededOperatorAudit();
  const hasher = new FakePasswordHasher();
  const rateLimiter = new InMemoryRateLimiter();
  const unitOfWork = new PassThroughUnitOfWork();
  const sessionIssuer = new SessionIssuer({
    tokenIssuer: new FakeTokenIssuer(),
    clock,
    policy: { refreshTokenTtlDays: 30, familyMaxDays: 90, ipHashSecret: "test-ip-hash-secret" },
  });
  const events = new RecordingEventPublisher();
  const registerDependencies = {
    users,
    sessions,
    hasher,
    sessionIssuer,
    unitOfWork,
    events,
    clock,
  };
  return {
    clock,
    users,
    sessions,
    operators,
    seededOperatorAudit,
    hasher,
    rateLimiter,
    events,
    registerUser: new RegisterUserUseCase(registerDependencies),
    login: new LoginUseCase({ users, sessions, hasher, sessionIssuer, rateLimiter, clock }),
    refreshSession: new RefreshSessionUseCase({
      users,
      sessions,
      sessionIssuer,
      unitOfWork,
      clock,
    }),
    logout: new LogoutUseCase({ sessions, clock }),
    logoutAll: new LogoutAllUseCase({ sessions, clock }),
    getMe: new GetMeUseCase({ users }),
    updateMe: new UpdateMeUseCase({ users }),
    ensurePlatformAdmin: new EnsurePlatformAdminUseCase({
      users,
      operators,
      hasher,
      unitOfWork,
      seededOperatorAudit,
      clock,
    }),
  };
}

export function aRegistration(overrides: Partial<RegisterUserInput> = {}): RegisterUserInput {
  return {
    name: "Rahim Uddin",
    email: "rahim@example.com",
    password: TEST_PASSWORD,
    client: { userAgent: "test-agent", ipAddress: "203.0.113.5" },
    ...overrides,
  };
}

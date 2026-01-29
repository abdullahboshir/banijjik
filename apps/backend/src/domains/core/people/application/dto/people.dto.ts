import { z } from "zod";
import { JoinOrganizationSchema } from "@banijjik/validation";

export type JoinOrganizationDto = z.infer<typeof JoinOrganizationSchema>;

// Note: ProfileResponseDto has been moved to @banijjik/contracts

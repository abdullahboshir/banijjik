import { z } from "zod";
import { CreateOrganizationSchema } from "@banijjik/validation";

export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;

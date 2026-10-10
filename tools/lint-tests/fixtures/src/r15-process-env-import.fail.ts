import { env } from "node:process";

export const nodeEnvironment: string | undefined = env["NODE_ENV"];

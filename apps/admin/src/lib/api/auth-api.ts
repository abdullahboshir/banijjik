import type { LoginRequest, MeResponse, UserRegisterRequest } from "@banijjik/contracts";
import { apiFetch } from "./api-client";

/** Signs in; the API sets the session cookies and answers with the person. */
export async function login(request: LoginRequest): Promise<MeResponse> {
  const result = await apiFetch<MeResponse>("/auth/login", { method: "POST", body: request });
  return result.data;
}

/** Creates the account and signs the person in at once (card 1.1). */
export async function register(request: UserRegisterRequest): Promise<MeResponse> {
  const result = await apiFetch<MeResponse>("/auth/register", { method: "POST", body: request });
  return result.data;
}

/** Ends this session and clears its cookies. */
export async function logout(): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST" });
}

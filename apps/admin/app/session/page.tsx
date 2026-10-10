import type { ReactElement } from "react";
import { safeNextPath } from "../../src/auth/safe-next-path";
import { SessionRenewal } from "../../src/auth/session-renewal";

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}): Promise<ReactElement> {
  const { next } = await searchParams;
  return <SessionRenewal nextPath={safeNextPath(next)} />;
}

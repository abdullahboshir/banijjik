import type { ReactElement, ReactNode } from "react";
import { requireOrgAccess } from "../../../src/shell/org-access";

/** The till is full screen: no business shell, but the same membership check every business route runs. */
export default async function PosLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  await requireOrgAccess(orgSlug);
  return <main className="min-h-dvh bg-surface text-primary">{children}</main>;
}

"use client";

import { useEffect, useState, type ComponentType, type ReactElement } from "react";
import type { ApprovalPinSectionProps } from "./approval-pin-section";

type SectionComponent = ComponentType<ApprovalPinSectionProps>;

/**
 * The approval PIN form only renders inside the open account menu, so its code is fetched when it
 * first mounts and stays out of every route's initial JS budget (13-UX section 11), like the menu.
 */
export function LazyApprovalPinSection(props: ApprovalPinSectionProps): ReactElement | null {
  const [Section, setSection] = useState<SectionComponent | null>(null);

  useEffect(() => {
    if (Section) return;
    async function loadSection(): Promise<void> {
      const sectionModule = await import("./approval-pin-section");
      setSection(() => sectionModule.ApprovalPinSection);
    }
    void loadSection();
  }, [Section]);

  return Section ? <Section {...props} /> : null;
}

"use client";

import dynamic from "next/dynamic";

// A contact page loads the credit section only when the contact has a credit account, so the other
// contact pages keep to the initial script budget (13-UX section 11).
export const ContactCreditsSectionLazy = dynamic(
  async () => (await import("./contact-credits-section")).ContactCreditsSection,
);

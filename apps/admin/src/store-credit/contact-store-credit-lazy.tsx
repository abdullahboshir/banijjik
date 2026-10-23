"use client";

import dynamic from "next/dynamic";

export const ContactStoreCreditLazy = dynamic(
  async () => (await import("./store-credit-section")).StoreCreditSection,
);

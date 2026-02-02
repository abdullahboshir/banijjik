export const STOREFRONT_SECTION_TYPE_ENUM = [
  "HERO",
  "ABOUT",
  "FEATURES",
  "SERVICES",
  "TESTIMONIALS",
  "FAQ",
  "GALLERY",
  "CONTACT",
  "BOOKING",
  "SERIAL",
  "APPOINTMENT",
] as const;

export type StorefrontSectionType =
  (typeof STOREFRONT_SECTION_TYPE_ENUM)[number];

export const STOREFRONT_SECTION_TYPE = STOREFRONT_SECTION_TYPE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in StorefrontSectionType]: K },
);

export const STOREFRONT_STATUS_ENUM = [
  "DRAFT",
  "PUBLISHED",
  "MAINTENANCE",
] as const;
export type StorefrontStatusType = (typeof STOREFRONT_STATUS_ENUM)[number];

export const STOREFRONT_STATUS = STOREFRONT_STATUS_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in StorefrontStatusType]: K },
);

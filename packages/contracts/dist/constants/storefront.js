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
];
export const STOREFRONT_SECTION_TYPE = STOREFRONT_SECTION_TYPE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
export const STOREFRONT_STATUS_ENUM = [
    "DRAFT",
    "PUBLISHED",
    "MAINTENANCE",
];
export const STOREFRONT_STATUS = STOREFRONT_STATUS_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=storefront.js.map
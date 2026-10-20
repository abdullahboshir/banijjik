import { LISTING_FIELD_TIER } from "@banijjik/contracts/directory";
import { CUSTOM_FIELD_SCOPE, CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { QueueCard } = await import("./queue-card");

const listing = {
  listingId: "01900000-0000-7000-8000-000000000001",
  listingNumber: "BD-1",
  ownerCustomerAccountId: "01900000-0000-7000-8000-000000000002",
  status: "SUBMITTED" as const,
  customFields: { age_band: "25", secret: "no" },
  photoFileIds: [],
  consentsAccepted: [],
  submittedAt: "2026-10-20T04:00:00.000Z",
  reviewedAt: "2026-10-19T04:00:00.000Z",
  reviewedByUserId: "01900000-0000-7000-8000-000000000003",
  rejection: null,
  publishedAt: null,
  version: 2,
  createdAt: "2026-10-18T04:00:00.000Z",
  updatedAt: "2026-10-20T04:00:00.000Z",
};

describe("QueueCard", () => {
  it("shows number, edited-after-approval badge and public preview fields", () => {
    const html = renderToStaticMarkup(
      <QueueCard
        listing={listing}
        href="/acme/directory/listings/x"
        previewFields={[
          {
            scope: CUSTOM_FIELD_SCOPE.ORGANIZATION,
            isEditable: true,
            entityType: "listing",
            fieldKey: "age_band",
            label: { bn: "বয়স", en: "Age" },
            fieldType: CUSTOM_FIELD_TYPE.SELECT,
            isRequired: true,
            visibility: { admin: true, storefront: true, bot: false },
            botAsk: false,
            isSearchable: false,
            isSensitive: false,
            sortOrder: 1,
            version: 1,
            status: "ACTIVE",
            listingTier: LISTING_FIELD_TIER.PUBLIC,
            sectionKey: "basics",
          },
        ]}
        locale="en"
        labels={{
          editedAfterApproval: "Edited after approval",
          submittedAt: "Submitted",
          open: "Review",
          status: (status) => status,
        }}
      />,
    );
    expect(html).toContain("BD-1");
    expect(html).toContain("Edited after approval");
    expect(html).toContain("Age");
    expect(html).toContain("25");
    expect(html).not.toContain("secret");
  });
});

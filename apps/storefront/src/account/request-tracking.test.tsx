import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CheckoutReceiptView, HoldCountdown } from "./checkout-receipt-view";
import { LostCookieHelpNotice, RequestDetailView, RequestHistoryView } from "./request-history";
import {
  claimCheckout,
  getCheckoutDetail,
  getRequestDetail,
  getRequestHistory,
  type CheckoutDetailResponse,
  type RequestDetailResponse,
  type RequestHistoryItem,
} from "./requests-api";
import * as clientApi from "../api/client-api";

describe("Request Tracking & Guest Claim UI", () => {
  const sampleCheckout: CheckoutDetailResponse = {
    checkoutId: "chk_018f2d80_test_01",
    organizationId: "org_018f2d80_acme",
    locationId: "loc_018f2d80_dhk",
    status: "CONFIRMED",
    requests: [
      {
        selectionIds: ["sel_1"],
        requestType: "ORDER",
        requestId: "req_ord_101",
        publicNumber: "ORD-9876",
        status: "CONFIRMED",
        paymentRequired: { amount: 150000, currency: "BDT" },
        holdExpiresAt: null,
      },
      {
        selectionIds: ["sel_2"],
        requestType: "BOOKING",
        requestId: "req_bok_202",
        publicNumber: "BOK-5432",
        status: "HELD",
        paymentRequired: { amount: 50000, currency: "BDT" },
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    ],
    contactSnapshot: {
      name: "Sadia Rahman",
      phoneE164: "+8801712345678",
    },
    acceptedTotals: { amount: 200000, currency: "BDT" },
    createdAt: new Date().toISOString(),
    ownerType: "GUEST",
    canClaim: true,
  };

  const sampleItems: readonly RequestHistoryItem[] = [
    {
      requestType: "ORDER",
      requestId: "req_ord_101",
      publicNumber: "ORD-9876",
      status: "CONFIRMED",
      paymentRequired: { amount: 150000, currency: "BDT" },
      holdExpiresAt: null,
      createdAt: new Date().toISOString(),
    },
    {
      requestType: "ENROLLMENT",
      requestId: "req_enr_303",
      publicNumber: "ENR-1122",
      status: "ACTIVE",
      paymentRequired: { amount: 0, currency: "BDT" },
      holdExpiresAt: null,
      createdAt: new Date().toISOString(),
    },
  ];

  it("renders checkout receipt with request list, status, and financial totals", () => {
    const html = renderToStaticMarkup(
      <CheckoutReceiptView
        organizationId="org_018f2d80_acme"
        checkoutId={sampleCheckout.checkoutId}
        initialData={sampleCheckout}
        locale="en"
      />,
    );

    // Verifies checkout id and contact snapshot
    expect(html).toContain("chk_018f2d80_test_01");
    expect(html).toContain("Sadia Rahman");
    expect(html).toContain("01712-345678");

    // Verifies requests list
    expect(html).toContain("ORD-9876");
    expect(html).toContain("BOK-5432");

    // Verifies status
    expect(html).toContain("CONFIRMED");
    expect(html).toContain("HELD");

    // Verifies money formatting (BDT ৳ symbol)
    expect(html).toContain("৳");
  });

  it("renders checkout receipt in Bengali locale", () => {
    const htmlBn = renderToStaticMarkup(
      <CheckoutReceiptView
        organizationId="org_018f2d80_acme"
        checkoutId={sampleCheckout.checkoutId}
        initialData={sampleCheckout}
        locale="bn"
      />,
    );

    expect(htmlBn).toContain("চেকআউট নিশ্চিতকরণ");
    expect(htmlBn).toContain("Sadia Rahman");
    expect(htmlBn).toContain("৳");
  });

  it("renders hold countdown when active and hold expired when in the past", () => {
    const futureHold = new Date(Date.now() + 600 * 1000).toISOString();
    const activeHtml = renderToStaticMarkup(<HoldCountdown expiresAt={futureHold} locale="en" />);
    expect(activeHtml).toContain("Hold expires in");

    const pastHold = new Date(Date.now() - 60 * 1000).toISOString();
    const expiredHtml = renderToStaticMarkup(<HoldCountdown expiresAt={pastHold} locale="en" />);
    expect(expiredHtml).toContain("Hold expired");
  });

  it("renders guest-to-customer claim action when guest matches customer session", () => {
    const htmlCanClaim = renderToStaticMarkup(
      <CheckoutReceiptView
        organizationId="org_018f2d80_acme"
        checkoutId={sampleCheckout.checkoutId}
        initialData={{ ...sampleCheckout, ownerType: "GUEST", canClaim: true }}
        locale="en"
      />,
    );
    expect(htmlCanClaim).toContain("Link order to your account");
    expect(htmlCanClaim).toContain("Claim checkout to my account");

    const htmlCannotClaim = renderToStaticMarkup(
      <CheckoutReceiptView
        organizationId="org_018f2d80_acme"
        checkoutId={sampleCheckout.checkoutId}
        initialData={{ ...sampleCheckout, ownerType: "GUEST", canClaim: false }}
        locale="en"
      />,
    );
    expect(htmlCannotClaim).toContain("Sign in to claim");

    const htmlCustomer = renderToStaticMarkup(
      <CheckoutReceiptView
        organizationId="org_018f2d80_acme"
        checkoutId={sampleCheckout.checkoutId}
        initialData={{ ...sampleCheckout, ownerType: "CUSTOMER", canClaim: false }}
        locale="en"
      />,
    );
    expect(htmlCustomer).toContain("Linked to your customer account");
  });

  it("renders lost-cookie help guidance message in requests view and standalone notice", () => {
    const expectedHelpText =
      "If you placed an order as a guest and cleared your cookies or switched browsers, sign in to your verified customer account to view your past requests or contact support with your request number.";

    const noticeHtml = renderToStaticMarkup(<LostCookieHelpNotice locale="en" />);
    expect(noticeHtml).toContain(expectedHelpText);

    const viewHtml = renderToStaticMarkup(
      <RequestHistoryView
        organizationId="org_018f2d80_acme"
        initialItems={sampleItems}
        locale="en"
      />,
    );
    expect(viewHtml).toContain(expectedHelpText);
    expect(viewHtml).toContain("ORD-9876");
    expect(viewHtml).toContain("ENR-1122");
  });

  it("renders individual request detail view with item breakdown and payment status", () => {
    const detailData: RequestDetailResponse = {
      requestType: "ORDER",
      requestId: "req_ord_101",
      publicNumber: "ORD-9876",
      status: "CONFIRMED",
      paymentRequired: { amount: 150000, currency: "BDT" },
      holdExpiresAt: null,
      createdAt: new Date().toISOString(),
      items: [{ title: "Organic Rice 5kg x 2" }, { title: "Mustard Oil 1L x 1" }],
    };

    const html = renderToStaticMarkup(
      <RequestDetailView
        organizationId="org_018f2d80_acme"
        requestType="ORDER"
        requestId="req_ord_101"
        initialData={detailData}
        locale="en"
      />,
    );

    expect(html).toContain("ORD-9876");
    expect(html).toContain("Organic Rice 5kg x 2");
    expect(html).toContain("Mustard Oil 1L x 1");
    expect(html).toContain("Payment required");
    expect(html).toContain("৳");
  });

  it("executes typed client API calls through storefront proxy routes", async () => {
    const callSpy = vi.spyOn(clientApi, "callStorefront").mockResolvedValue({
      ok: true,
      status: 200,
      data: sampleCheckout,
      fields: [],
    });

    // 1. getCheckoutDetail
    const checkoutResult = await getCheckoutDetail("org_acme", "chk_101");
    expect(callSpy).toHaveBeenCalledWith("GET", "/orgs/org_acme/checkouts/chk_101");
    expect(checkoutResult.ok).toBe(true);

    // 2. claimCheckout
    callSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { success: true, checkoutId: "chk_101" },
      fields: [],
    });
    const claimResult = await claimCheckout("org_acme", "chk_101");
    expect(callSpy).toHaveBeenCalledWith("POST", "/orgs/org_acme/checkouts/chk_101/claim");
    expect(claimResult.ok).toBe(true);

    // 3. getRequestHistory
    callSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { items: sampleItems },
      fields: [],
    });
    const historyResult = await getRequestHistory("org_acme");
    expect(callSpy).toHaveBeenCalledWith("GET", "/orgs/org_acme/me/requests");
    expect(historyResult.ok).toBe(true);

    // 4. getRequestDetail
    callSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { ...sampleItems[0] },
      fields: [],
    });
    const detailResult = await getRequestDetail("org_acme", "ORDER", "req_ord_101");
    expect(callSpy).toHaveBeenCalledWith("GET", "/orgs/org_acme/me/requests/ORDER/req_ord_101");
    expect(detailResult.ok).toBe(true);

    callSpy.mockRestore();
  });
});

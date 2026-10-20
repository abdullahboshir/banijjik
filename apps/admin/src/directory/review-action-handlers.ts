import { approveListing, hideListing, rejectListing, unhideListing } from "./directory-api";
import { runReviewAction } from "./review-run";

type Panel = "none" | "approve" | "reject";

interface HandlerDeps {
  organizationId: string;
  listingId: string;
  version: number;
  queueHref: string;
  setBusy: (busy: boolean) => void;
  setConflict: (conflict: boolean) => void;
  setPanel: (panel: Panel) => void;
  push: (href: string) => void;
  refresh: () => void;
}

function runWith(deps: HandlerDeps, action: () => Promise<unknown>, leaveQueue: boolean): void {
  deps.setConflict(false);
  void runReviewAction({
    action,
    leaveQueue,
    onBusy: deps.setBusy,
    onConflict: () => deps.setConflict(true),
    onSuccessLeave: () => {
      deps.push(deps.queueHref);
      deps.refresh();
    },
    onSuccessStay: () => {
      deps.refresh();
      deps.setPanel("none");
    },
  });
}

export function createReviewHandlers(deps: HandlerDeps): {
  onReject: (payload: { reasonKeys: readonly string[]; note?: string }) => void;
  onHide: () => void;
  onUnhide: () => void;
  onApprove: () => void;
} {
  const { organizationId, listingId, version } = deps;
  return {
    onReject: (payload) =>
      runWith(
        deps,
        () =>
          rejectListing(organizationId, listingId, {
            reasonKeys: [...payload.reasonKeys],
            version,
            ...(payload.note === undefined ? {} : { note: payload.note }),
          }),
        true,
      ),
    onHide: () => runWith(deps, () => hideListing(organizationId, listingId, { version }), false),
    onUnhide: () =>
      runWith(deps, () => unhideListing(organizationId, listingId, { version }), false),
    onApprove: () =>
      runWith(deps, () => approveListing(organizationId, listingId, { version }), true),
  };
}

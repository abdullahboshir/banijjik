import type { Translator } from "@banijjik/i18n";
import type { ReactElement } from "react";
import type { BannerState } from "./banner-state";

function messageOf(state: BannerState, t: Translator["t"]): string {
  if (state.kind === "readOnly") return t("banner.readOnly");
  if (state.kind === "pastDue") return t("banner.pastDue");
  if (state.daysLeft === 0) return t("banner.trial.today");
  if (state.daysLeft === 1) return t("banner.trial.oneDay");
  return t("banner.trial.days", { days: state.daysLeft });
}

const TONE_CLASS: Record<BannerState["kind"], string> = {
  readOnly: "border-danger",
  pastDue: "border-warning",
  trial: "border-info",
};

/**
 * The banners above the page content (13-UX section 5). A server component with no script of its own.
 * There is no billing link yet (billing is card 6.2), so the text only explains.
 */
export function SubscriptionBanners({
  states,
  t,
}: {
  states: BannerState[];
  t: Translator["t"];
}): ReactElement | null {
  if (states.length === 0) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {states.map((state) => (
        <p
          key={state.kind}
          role="status"
          className={`rounded-md border-s-4 bg-subtle px-4 py-3 text-small text-primary ${TONE_CLASS[state.kind]}`}
        >
          {messageOf(state, t)}
        </p>
      ))}
    </div>
  );
}

import type { Translator } from "@banijjik/i18n";

/** Every visible string of the till, resolved on the server so the client bundle carries no catalog. */
export interface PosLabels {
  readonly title: string;
  readonly pairTitle: string;
  readonly pairHint: string;
  readonly pairCode: string;
  readonly pairSubmit: string;
  readonly pairInvalid: string;
  readonly openTitle: string;
  readonly openFloat: string;
  readonly openSubmit: string;
  readonly alreadyOpen: string;
  readonly searchPlaceholder: string;
  readonly noResults: string;
  readonly cart: string;
  readonly cartEmpty: string;
  readonly total: string;
  readonly clear: string;
  readonly remove: string;
  readonly quantity: string;
  readonly add: string;
  readonly pay: string;
  readonly saleSaved: string;
  readonly saleFailed: string;
  readonly loading: string;
  readonly loadFailed: string;
  readonly retry: string;
  readonly noDevice: string;
  readonly offline: string;
  readonly permissionDenied: string;
}

export function posLabelsOf(translator: Translator): PosLabels {
  const { t } = translator;
  return {
    title: t("pos.title"),
    pairTitle: t("pos.pair.title"),
    pairHint: t("pos.pair.hint"),
    pairCode: t("pos.pair.code"),
    pairSubmit: t("pos.pair.submit"),
    pairInvalid: t("pos.pair.invalid"),
    openTitle: t("pos.session.openTitle"),
    openFloat: t("pos.session.float"),
    openSubmit: t("pos.session.open"),
    alreadyOpen: t("pos.session.alreadyOpen"),
    searchPlaceholder: t("pos.sale.search"),
    noResults: t("pos.sale.noResults"),
    cart: t("pos.sale.cart"),
    cartEmpty: t("pos.sale.empty"),
    total: t("pos.sale.total"),
    clear: t("pos.sale.clear"),
    remove: t("pos.sale.remove"),
    quantity: t("pos.sale.quantity"),
    add: t("pos.sale.add"),
    pay: t("pos.sale.pay"),
    saleSaved: t("pos.sale.saved"),
    saleFailed: t("pos.sale.failed"),
    loading: t("pos.state.loading"),
    loadFailed: t("pos.state.loadFailed"),
    retry: t("pos.state.retry"),
    noDevice: t("pos.state.noDevice"),
    offline: t("pos.state.offline"),
    permissionDenied: t("state.permissionDenied"),
  };
}

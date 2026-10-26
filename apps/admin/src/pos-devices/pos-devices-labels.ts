import type { Translate } from "./pos-devices-view";

/** Plain labels of the devices list (cards on a phone). Strings with a value in them are built where they are shown. */
export interface PosDevicesListLabels {
  readonly name: string;
  readonly location: string;
  readonly state: string;
  readonly actions: string;
  readonly revoke: string;
  readonly empty: string;
}

export interface PosDeviceAddLabels {
  readonly add: string;
  readonly title: string;
  readonly name: string;
  readonly location: string;
  readonly submit: string;
  readonly close: string;
  readonly codeTitle: string;
  readonly codeHint: string;
  readonly codeOnce: string;
  readonly done: string;
  /** Shown when the package is full (the button is off, or the API refused an add at the limit). */
  readonly limitReached: string | undefined;
}

export interface PosDeviceRevokeLabels {
  readonly description: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly close: string;
  readonly conflict: string;
}

export interface PosDevicesFilterLabels {
  readonly label: string;
  readonly all: string;
  readonly previous: string;
  readonly next: string;
}

export function devicesListLabelsOf(t: Translate): PosDevicesListLabels {
  return {
    name: t("posDevices.column.name"),
    location: t("posDevices.column.location"),
    state: t("posDevices.column.state"),
    actions: t("posDevices.column.actions"),
    revoke: t("posDevices.revoke"),
    empty: t("posDevices.empty"),
  };
}

/** `limit` is the device limit of the package (`null` = unlimited, so no limit notice). */
export function deviceAddLabelsOf(t: Translate, limit: number | null): PosDeviceAddLabels {
  return {
    add: t("posDevices.add"),
    title: t("posDevices.form.title"),
    name: t("posDevices.form.name"),
    location: t("posDevices.form.location"),
    submit: t("posDevices.form.submit"),
    close: t("shell.closeMenu"),
    codeTitle: t("posDevices.code.title"),
    codeHint: t("posDevices.code.hint"),
    codeOnce: t("posDevices.code.once"),
    done: t("posDevices.code.done"),
    limitReached: limit === null ? undefined : t("posDevices.limitReached", { limit }),
  };
}

export function deviceRevokeLabelsOf(t: Translate): PosDeviceRevokeLabels {
  return {
    description: t("posDevices.revoke.description"),
    confirm: t("posDevices.revoke.confirm"),
    cancel: t("common.cancel"),
    close: t("shell.closeMenu"),
    conflict: t("posDevices.revoke.conflict"),
  };
}

export function devicesFilterLabelsOf(t: Translate): PosDevicesFilterLabels {
  return {
    label: t("posDevices.filter.label"),
    all: t("posDevices.filter.all"),
    previous: t("posDevices.page.previous"),
    next: t("posDevices.page.next"),
  };
}

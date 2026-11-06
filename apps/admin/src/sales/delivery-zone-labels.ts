export interface DeliveryZoneLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly newZone: string;
  readonly empty: string;
  readonly zoneKey: string;
  readonly name: string;
  readonly nameEn: string;
  readonly nameBn: string;
  readonly fee: string;
  readonly areaCodes: string;
  readonly areaCodesPlaceholder: string;
  readonly status: string;
  readonly statusActive: string;
  readonly statusInactive: string;
  readonly actions: string;
  readonly edit: string;
  readonly save: string;
  readonly cancel: string;
  readonly createTitle: string;
  readonly editTitle: string;
  readonly createdSuccess: string;
  readonly updatedSuccess: string;
  readonly failed: string;
  readonly currencyMismatch: string;
  readonly duplicateAreaCode: string;
  readonly feeInvalid: string;
  readonly zoneKeyRequired: string;
  readonly nameEnRequired: string;
  readonly nameBnRequired: string;
  readonly areaCodesRequired: string;
}

export function deliveryZoneLabelsOf(t: (key: string) => string): DeliveryZoneLabels {
  return {
    title: t("deliveryZones.list.title"),
    subtitle: t("deliveryZones.list.subtitle"),
    newZone: t("deliveryZones.list.newZone"),
    empty: t("deliveryZones.list.empty"),
    zoneKey: t("deliveryZones.list.zoneKey"),
    name: t("deliveryZones.list.name"),
    nameEn: t("deliveryZones.list.nameEn"),
    nameBn: t("deliveryZones.list.nameBn"),
    fee: t("deliveryZones.list.fee"),
    areaCodes: t("deliveryZones.list.areaCodes"),
    areaCodesPlaceholder: t("deliveryZones.list.areaCodesPlaceholder"),
    status: t("deliveryZones.list.status"),
    statusActive: t("deliveryZones.list.statusActive"),
    statusInactive: t("deliveryZones.list.statusInactive"),
    actions: t("deliveryZones.list.actions"),
    edit: t("deliveryZones.list.edit"),
    save: t("deliveryZones.form.save"),
    cancel: t("deliveryZones.form.cancel"),
    createTitle: t("deliveryZones.form.createTitle"),
    editTitle: t("deliveryZones.form.editTitle"),
    createdSuccess: t("deliveryZones.form.createdSuccess"),
    updatedSuccess: t("deliveryZones.form.updatedSuccess"),
    failed: t("deliveryZones.form.failed"),
    currencyMismatch: t("deliveryZones.form.currencyMismatch"),
    duplicateAreaCode: t("deliveryZones.form.duplicateAreaCode"),
    feeInvalid: t("deliveryZones.form.feeInvalid"),
    zoneKeyRequired: t("deliveryZones.form.zoneKeyRequired"),
    nameEnRequired: t("deliveryZones.form.nameEnRequired"),
    nameBnRequired: t("deliveryZones.form.nameBnRequired"),
    areaCodesRequired: t("deliveryZones.form.areaCodesRequired"),
  };
}

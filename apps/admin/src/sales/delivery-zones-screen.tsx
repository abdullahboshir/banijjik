"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { DeliveryZone } from "@banijjik/contracts/sales/delivery";
import { Button, EmptyState, MoneyText, PageLayout, type DisplayLocale } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { DeliveryZoneForm } from "./delivery-zone-form";
import type { DeliveryZoneLabels } from "./delivery-zone-labels";

export interface DeliveryZonesScreenProps {
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly initialZones: readonly DeliveryZone[];
  readonly currency: CurrencyCode;
  readonly labels: DeliveryZoneLabels;
  readonly locale: DisplayLocale;
  readonly canManage: boolean;
}

interface DeliveryZoneRowProps {
  readonly zone: DeliveryZone;
  readonly locale: DisplayLocale;
  readonly labels: DeliveryZoneLabels;
  readonly canManage: boolean;
  readonly onEdit: (zone: DeliveryZone) => void;
}

function DeliveryZoneRow(props: DeliveryZoneRowProps): ReactElement {
  const { zone, locale, labels, canManage, onEdit } = props;
  const isInactive = zone.status === "INACTIVE";
  const badgeClass = isInactive ? "bg-subtle text-secondary" : "bg-brand/10 text-brand";

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary">{locale === "bn" ? zone.name.bn : zone.name.en}</span>
          <span className="text-small text-secondary">({zone.zoneKey})</span>
          <span className={`rounded px-2 py-0.5 text-caption font-semibold ${badgeClass}`}>
            {isInactive ? labels.statusInactive : labels.statusActive}
          </span>
        </div>
        <div className="text-small text-secondary">
          {labels.areaCodes}: {zone.areaCodes.join(", ")}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="font-money text-body font-semibold text-primary">
          <MoneyText money={zone.fee} locale={locale} />
        </div>
        {canManage ? (
          <Button variant="secondary" onClick={() => onEdit(zone)}>
            {labels.edit}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function updateZoneList(prev: readonly DeliveryZone[], saved: DeliveryZone): readonly DeliveryZone[] {
  const idx = prev.findIndex((z) => z.deliveryZoneId === saved.deliveryZoneId);
  if (idx < 0) return [saved, ...prev];
  const next = [...prev];
  next[idx] = saved;
  return next;
}

export function DeliveryZonesScreen(props: DeliveryZonesScreenProps): ReactElement {
  const { labels, canManage, currency, locale, organizationId } = props;
  const [zones, setZones] = useState<readonly DeliveryZone[]>(props.initialZones);
  const [editingZone, setEditingZone] = useState<DeliveryZone | "new" | null>(null);

  function handleSaved(saved: DeliveryZone): void {
    setZones((prev) => updateZoneList(prev, saved));
    setEditingZone(null);
  }

  const showNewButton = canManage && editingZone === null;
  return (
    <PageLayout
      title={labels.title}
      subtitle={labels.subtitle}
      actions={showNewButton ? <Button onClick={() => setEditingZone("new")}>{labels.newZone}</Button> : undefined}
    >
      <div className="flex flex-col gap-6">
        {editingZone !== null ? (
          <DeliveryZoneForm
            organizationId={organizationId}
            zone={editingZone === "new" ? undefined : editingZone}
            currency={currency}
            labels={labels}
            onSaved={handleSaved}
            onCancel={() => setEditingZone(null)}
          />
        ) : null}
        {zones.length === 0 ? (
          <EmptyState kind="noResults" message={labels.empty} />
        ) : (
          <div className="flex flex-col divide-y divide-default rounded-lg border border-default bg-surface">
            {zones.map((zone) => (
              <DeliveryZoneRow
                key={zone.deliveryZoneId}
                zone={zone}
                locale={locale}
                labels={labels}
                canManage={canManage}
                onEdit={setEditingZone}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

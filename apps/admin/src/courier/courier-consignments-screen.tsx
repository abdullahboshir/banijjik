"use client";

import type { ManualCourierKey } from "@banijjik/contracts/courier";
import { Button, Select } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { CourierSettlementSheet } from "./courier-settlement-sheet";
import type { CourierConsignmentsViewProps } from "./courier-types";

export function CourierConsignmentsScreen({
  organizationId,
  consignments,
  labels,
  canRecordSettlement,
}: CourierConsignmentsViewProps): ReactElement {
  const [courierFilter, setCourierFilter] = useState<string>("ALL");
  const [showSettlementSheet, setShowSettlementSheet] = useState(false);

  const filteredConsignments = consignments.filter((c) => {
    if (courierFilter !== "ALL" && c.courierKey !== courierFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold">{labels.title}</h1>
          <p className="text-body text-muted">{labels.subtitle}</p>
        </div>
        {canRecordSettlement ? (
          <Button
            variant="primary"
            onClick={() => setShowSettlementSheet(true)}
          >
            {labels.recordSettlement}
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <label htmlFor="courier-filter" className="text-sm font-medium">
          {labels.courierKey}:
        </label>
        <Select
          id="courier-filter"
          value={courierFilter}
          onChange={(e) => setCourierFilter(e.target.value)}
        >
          <option value="ALL">{labels.filterCourierAll}</option>
          <option value="STEADFAST">STEADFAST</option>
          <option value="PATHAO">PATHAO</option>
          <option value="REDX">REDX</option>
          <option value="PAPERFLY">PAPERFLY</option>
          <option value="OTHER">OTHER</option>
        </Select>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/20 font-medium">
              <th className="p-3">{labels.trackingNumber}</th>
              <th className="p-3">{labels.courierKey}</th>
              <th className="p-3">{labels.orderId}</th>
              <th className="p-3">{labels.status}</th>
              <th className="p-3">{labels.created}</th>
            </tr>
          </thead>
          <tbody>
            {filteredConsignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted">
                  {labels.empty}
                </td>
              </tr>
            ) : (
              filteredConsignments.map((c) => (
                <tr key={c.consignmentId} className="border-b hover:bg-muted/10">
                  <td className="p-3 font-mono font-medium">{c.trackingNumber}</td>
                  <td className="p-3">{c.courierKey}</td>
                  <td className="p-3 font-mono text-xs">{c.orderId}</td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border">
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted text-xs">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showSettlementSheet ? (
        <CourierSettlementSheet
          open={showSettlementSheet}
          onOpenChange={setShowSettlementSheet}
          organizationId={organizationId}
          labels={labels}
        />
      ) : null}
    </div>
  );
}

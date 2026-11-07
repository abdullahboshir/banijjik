"use client";

import type { DeliveryAssignmentStatus } from "@banijjik/contracts/delivery";
import { Button, Select } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { DeliveryAssignmentsViewProps } from "./delivery-types";
import { RiderHandoverSheet } from "./rider-handover-sheet";

export function DeliveryAssignmentsScreen({
  organizationId,
  assignments,
  labels,
  canRecordHandover,
}: DeliveryAssignmentsViewProps): ReactElement {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showHandoverSheet, setShowHandoverSheet] = useState(false);

  const filteredAssignments = assignments.filter((a) => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold">{labels.title}</h1>
          <p className="text-body text-muted">{labels.subtitle}</p>
        </div>
        {canRecordHandover ? (
          <Button
            variant="primary"
            onClick={() => setShowHandoverSheet(true)}
          >
            {labels.recordHandover}
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <label htmlFor="delivery-status-filter" className="text-sm font-medium">
          {labels.status}:
        </label>
        <Select
          id="delivery-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">{labels.statusAll}</option>
          <option value="ASSIGNED">ASSIGNED</option>
          <option value="IN_TRANSIT">IN_TRANSIT</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="FAILED">FAILED</option>
          <option value="CANCELLED">CANCELLED</option>
        </Select>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/20 font-medium">
              <th className="p-3">{labels.orderId}</th>
              <th className="p-3">{labels.rider}</th>
              <th className="p-3">Attempt</th>
              <th className="p-3">{labels.status}</th>
              <th className="p-3">{labels.notes}</th>
              <th className="p-3">{labels.created}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
                  {labels.empty}
                </td>
              </tr>
            ) : (
              filteredAssignments.map((a) => (
                <tr key={a.deliveryAssignmentId} className="border-b hover:bg-muted/10">
                  <td className="p-3 font-mono text-xs">{a.orderId}</td>
                  <td className="p-3 font-mono text-xs">{a.riderMemberId}</td>
                  <td className="p-3 text-center">{a.attemptOrdinal}</td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border">
                      {a.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted text-xs truncate max-w-[200px]">
                    {a.notes ?? "-"}
                  </td>
                  <td className="p-3 text-muted text-xs">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showHandoverSheet ? (
        <RiderHandoverSheet
          open={showHandoverSheet}
          onOpenChange={setShowHandoverSheet}
          organizationId={organizationId}
          labels={labels}
        />
      ) : null}
    </div>
  );
}

"use client";
import type { CheckInResponse } from "@banijjik/contracts/enrollment";
import { useTranslator } from "@banijjik/web-client/client";
import { Button, PageLayout } from "@banijjik/ui";
import { useEffect, useState, type ReactElement } from "react";
import { listCheckIns, recordCheckIn } from "./enrollment-api";
export function CheckInsPage({
  organizationId,
  locationId,
}: {
  organizationId: string;
  locationId: string;
}): ReactElement {
  const { t } = useTranslator();
  const [rows, setRows] = useState<CheckInResponse[]>([]);
  const [contactId, setContactId] = useState("");
  const date = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    const load = async () => {
      setRows(await listCheckIns(organizationId, date));
    };
    void load();
  }, [organizationId, date]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const row = await recordCheckIn(organizationId, { locationId, contactId });
    setRows((current) => [row, ...current]);
  };
  return (
    <PageLayout title={t("menu.enrollment.checkIns")}>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <input
          aria-label={t("enrollment.contact")}
          required
          value={contactId}
          onChange={(event) => setContactId(event.target.value)}
        />
        <Button type="submit">{t("enrollment.checkIn")}</Button>
      </form>
      <div className="mt-5 flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.checkInId} className="rounded border border-default p-3">
            {row.contactId} · {row.checkedInAt}
          </div>
        ))}
      </div>
    </PageLayout>
  );
}

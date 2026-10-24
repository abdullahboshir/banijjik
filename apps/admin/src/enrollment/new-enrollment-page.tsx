"use client";
import { Button, PageLayout } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { createEnrollment } from "./enrollment-api";
function EnrollmentForm(props: {
  contactId: string;
  offeringId: string;
  variantId: string;
  startsOn: string;
  error: string;
  onContactChange: (value: string) => void;
  onOfferingChange: (value: string) => void;
  onVariantChange: (value: string) => void;
  onStartChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  t: (key: string) => string;
}): ReactElement {
  const { t, onSubmit, error, contactId, offeringId, variantId, startsOn } = props;
  return (
    <form className="flex max-w-xl flex-col gap-4" onSubmit={onSubmit}>
      <label>
        {t("enrollment.contact")}
        <input
          required
          value={contactId}
          onChange={(event) => props.onContactChange(event.target.value)}
        />
      </label>
      <label>
        {t("offering.PLAN")}
        <input
          required
          value={offeringId}
          onChange={(event) => props.onOfferingChange(event.target.value)}
        />
      </label>
      <label>
        {t("enrollment.variant")}
        <input
          required
          value={variantId}
          onChange={(event) => props.onVariantChange(event.target.value)}
        />
      </label>
      <label>
        {t("enrollment.startDate")}
        <input
          type="date"
          required
          value={startsOn}
          onChange={(event) => props.onStartChange(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <Button type="submit">{t("enrollment.create")}</Button>
    </form>
  );
}

export function NewEnrollmentPage({
  organizationId,
  locationId,
}: {
  organizationId: string;
  locationId: string;
}): ReactElement {
  const { t } = useTranslator();
  const router = useRouter();
  const [contactId, setContactId] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      const enrollment = await createEnrollment(organizationId, {
        locationId,
        contactId,
        offeringId,
        variantId,
        startsOn,
        resourceIds: [],
        customFields: {},
      });
      router.push(`/enrollments/${enrollment.enrollmentId}`);
    } catch {
      setError(t("enrollment.errors.transition"));
    }
  };
  return (
    <PageLayout title={t("enrollment.new")}>
      <EnrollmentForm
        contactId={contactId}
        offeringId={offeringId}
        variantId={variantId}
        startsOn={startsOn}
        error={error}
        onContactChange={setContactId}
        onOfferingChange={setOfferingId}
        onVariantChange={setVariantId}
        onStartChange={setStartsOn}
        onSubmit={(event) => {
          void submit(event);
        }}
        t={t}
      />
    </PageLayout>
  );
}

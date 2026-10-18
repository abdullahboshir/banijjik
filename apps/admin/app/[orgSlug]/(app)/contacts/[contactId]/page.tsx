import type { ReactElement } from "react";
import { ContactDetailPage } from "../../../../../src/contacts/contact-detail-page";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ orgSlug: string; contactId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, contactId } = await params;
  return <ContactDetailPage orgSlug={orgSlug} contactId={contactId} />;
}

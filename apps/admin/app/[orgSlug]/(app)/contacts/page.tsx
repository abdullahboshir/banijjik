import type { ReactElement } from "react";
import { ContactListPage } from "../../../../src/contacts/contact-list-page";

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <ContactListPage orgSlug={orgSlug} searchParams={query} />;
}

import { DuesPage } from "../../../../../src/dues/dues-page";

export default async function Page(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgSlug }, searchParams] = await Promise.all([props.params, props.searchParams]);
  return <DuesPage orgSlug={orgSlug} searchParams={searchParams} />;
}

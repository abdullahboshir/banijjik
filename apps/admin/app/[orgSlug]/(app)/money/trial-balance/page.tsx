import { TrialBalancePage } from "../../../../../src/trial-balance/trial-balance-page";
export default async function Page(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgSlug }, searchParams] = await Promise.all([props.params, props.searchParams]);
  return <TrialBalancePage orgSlug={orgSlug} searchParams={searchParams} />;
}

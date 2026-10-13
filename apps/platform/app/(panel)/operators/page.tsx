import type { ReactElement } from "react";
import { OperatorsPage } from "../../../src/operators/operators-page";

export default async function OperatorsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  return <OperatorsPage searchParams={await searchParams} />;
}

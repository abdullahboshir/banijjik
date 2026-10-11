import type { ReactElement } from "react";
import { PackagesPage } from "../../../src/packages/packages-page";

export default function PackagesRoute(): Promise<ReactElement> {
  return PackagesPage();
}

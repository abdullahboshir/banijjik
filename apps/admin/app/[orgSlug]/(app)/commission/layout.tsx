import type { ReactElement, ReactNode } from "react";
import { CommissionClientText } from "../../../../src/commission/commission-client-text";

export default function CommissionLayout({ children }: { children: ReactNode }): ReactElement {
  return <CommissionClientText>{children}</CommissionClientText>;
}

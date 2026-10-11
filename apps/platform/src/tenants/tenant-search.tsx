"use client";

import type { OrganizationStatus } from "@banijjik/contracts";
import { TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { tenantListHref } from "./tenant-query";

const SEARCH_DEBOUNCE_MS = 300;

export interface TenantSearchProps {
  initialText: string;
  /** The status filter stays in the URL while the text changes. */
  status: OrganizationStatus | undefined;
  label: string;
}

/** The search box of the tenant list: it types into the URL after a short pause, so the server renders the result. */
export function TenantSearch({ initialText, status, label }: TenantSearchProps): ReactElement {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      // A new search starts at the first page.
      router.replace(tenantListHref({ status, q: text.trim() || undefined, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, status, router]);

  return (
    <div role="search">
      <TextInput
        type="search"
        name="q"
        value={text}
        aria-label={label}
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  );
}

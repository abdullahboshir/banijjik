"use client";

import { organizationFileUrl } from "@banijjik/web-client";
import type { ReactElement } from "react";
import { API_BASE_URL } from "../config/api-base-url";
import { API_PREFIX } from "../lib/api/api-url";

const URL_BASE = { baseUrl: API_BASE_URL, apiPrefix: API_PREFIX };

/** Private attachment links need the browser session cookie (purpose ATTACHMENT). */
export function ExpenseAttachmentLinks(props: {
  organizationId: string;
  fileIds: readonly string[];
  label: string;
}): ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {props.fileIds.map((fileId, index) => (
        <li key={fileId}>
          <a
            href={organizationFileUrl(URL_BASE, {
              organizationId: props.organizationId,
              fileId,
            })}
            className="inline-flex min-h-11 items-center text-brand underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            {props.label.replace("{n}", String(index + 1))}
          </a>
        </li>
      ))}
    </ul>
  );
}

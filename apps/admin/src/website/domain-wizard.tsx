"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import type { SiteDomainResponse } from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
import { Button, EmptyState } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import {
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactElement,
  type SetStateAction,
} from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { keyForSubmit, type KeyedSubmit } from "../invitations/idempotency-keeper";
import { ApiError } from "../lib/api/api-error";
import {
  addSiteDomain,
  fetchSiteDraft,
  removeSiteDomain,
  selectCanonicalSiteDomain,
  verifySiteDomain,
  type DomainMutation,
} from "./domain-api";
import { AddDomainForm, DomainCard, DomainNotice } from "./domain-card";

export interface DomainWizardProps {
  readonly organizationId: string;
  readonly initialItems: readonly SiteDomainResponse[];
  readonly canWrite: boolean;
}

type WizardSetters = {
  readonly busy: boolean;
  readonly setBusy: (busy: boolean) => void;
  readonly setNotice: (notice: string | undefined) => void;
  readonly setItems: Dispatch<SetStateAction<readonly SiteDomainResponse[]>>;
};

function noticeKeyOf(error: unknown): string {
  // Taken hosts are also HTTP 409; only the version CAS uses ERROR_CODE.CONFLICT.
  if (error instanceof ApiError && error.code === ERROR_CODE.CONFLICT) {
    return "website.domains.conflict";
  }
  if (error instanceof ApiError) return knownMessageKeyOrInternal(error.messageKey);
  return "website.domains.failed";
}

function applyUpdate(
  items: readonly SiteDomainResponse[],
  updated: SiteDomainResponse,
): SiteDomainResponse[] {
  const exists = items.some((item) => item.siteDomainId === updated.siteDomainId);
  const replaced = exists
    ? items.map((item) => (item.siteDomainId === updated.siteDomainId ? updated : item))
    : [updated, ...items];
  if (!updated.isCanonical) return replaced;
  return replaced.map((item) => ({
    ...item,
    isCanonical: item.siteDomainId === updated.siteDomainId,
  }));
}

async function runAction(
  input: WizardSetters & {
    readonly action: () => Promise<SiteDomainResponse>;
    readonly onDone?: (result: SiteDomainResponse) => void;
  },
): Promise<void> {
  if (input.busy) return;
  input.setBusy(true);
  input.setNotice(undefined);
  try {
    const result = await input.action();
    input.onDone?.(result);
    input.setItems((current) => applyUpdate(current, result));
    input.setNotice("website.domains.saved");
  } catch (error) {
    input.setNotice(noticeKeyOf(error));
  } finally {
    input.setBusy(false);
  }
}

function mutationOf(input: {
  readonly organizationId: string;
  readonly item: SiteDomainResponse;
  readonly previous: KeyedSubmit | undefined;
  readonly kind: string;
}): { readonly next: KeyedSubmit; readonly body: DomainMutation } {
  const next = keyForSubmit(
    input.previous,
    `${input.kind}:${input.item.siteDomainId}:${input.item.version}`,
    newId,
  );
  return {
    next,
    body: {
      organizationId: input.organizationId,
      siteDomainId: input.item.siteDomainId,
      version: input.item.version,
      idempotencyKey: next.key,
    },
  };
}

function submitAdd(input: {
  readonly event: FormEvent;
  readonly hostname: string;
  readonly organizationId: string;
  readonly lastAdd: { current: KeyedSubmit | undefined };
  readonly setHostname: (value: string) => void;
  readonly setters: WizardSetters;
}): void {
  input.event.preventDefault();
  const trimmed = input.hostname.trim();
  const submit = keyForSubmit(input.lastAdd.current, trimmed, newId);
  input.lastAdd.current = submit;
  void runAction({
    ...input.setters,
    action: () =>
      addSiteDomain({
        organizationId: input.organizationId,
        hostname: trimmed,
        idempotencyKey: submit.key,
      }),
    onDone: () => {
      input.lastAdd.current = undefined;
      input.setHostname("");
    },
  });
}

function submitKeyed(input: {
  readonly organizationId: string;
  readonly item: SiteDomainResponse;
  readonly kind: string;
  readonly lastAction: { current: KeyedSubmit | undefined };
  readonly setters: WizardSetters;
  readonly run: (body: DomainMutation) => Promise<SiteDomainResponse>;
  readonly onDone?: () => void;
}): void {
  const { next, body } = mutationOf({
    organizationId: input.organizationId,
    item: input.item,
    previous: input.lastAction.current,
    kind: input.kind,
  });
  input.lastAction.current = next;
  void runAction({
    ...input.setters,
    action: () => input.run(body),
    onDone: () => {
      input.lastAction.current = undefined;
      input.onDone?.();
    },
  });
}

/** Add, list, verify, remove and pick the public hostname of this business. */
export function DomainWizard(props: DomainWizardProps): ReactElement {
  const { t } = useTranslator();
  const [items, setItems] = useState<readonly SiteDomainResponse[]>(props.initialItems);
  const [hostname, setHostname] = useState("");
  const [notice, setNotice] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<SiteDomainResponse | undefined>();
  const lastAdd = useRef<KeyedSubmit | undefined>(undefined);
  const lastAction = useRef<KeyedSubmit | undefined>(undefined);
  const setters: WizardSetters = { busy, setBusy, setNotice, setItems };
  const keyed = { organizationId: props.organizationId, lastAction, setters };
  const labels = {
    emptyLabel: t("website.domains.empty"),
    removeTitle: t("website.domains.removeTitle"),
    removeConfirm: t("website.domains.removeConfirm"),
    cancelLabel: t("website.domains.cancel"),
  };
  return (
    <DomainWizardView
      {...labels}
      canWrite={props.canWrite}
      hostname={hostname}
      busy={busy}
      notice={notice}
      items={items}
      pendingRemove={pendingRemove}
      onHostname={setHostname}
      onAdd={(event) =>
        submitAdd({
          event,
          hostname,
          organizationId: props.organizationId,
          lastAdd,
          setHostname,
          setters,
        })
      }
      onVerify={(item) => submitKeyed({ ...keyed, item, kind: "verify", run: verifySiteDomain })}
      onCanonical={(item) =>
        void submitCanonical({ item, lastAction, setters, organizationId: props.organizationId })
      }
      onAskRemove={setPendingRemove}
      onCloseRemove={() => setPendingRemove(undefined)}
      onConfirmRemove={() => {
        if (pendingRemove === undefined) return;
        submitKeyed({
          ...keyed,
          item: pendingRemove,
          kind: "remove",
          run: removeSiteDomain,
          onDone: () => setPendingRemove(undefined),
        });
      }}
    />
  );
}

function submitCanonical(input: {
  readonly item: SiteDomainResponse;
  readonly organizationId: string;
  readonly lastAction: { current: KeyedSubmit | undefined };
  readonly setters: WizardSetters;
}): Promise<void> {
  return runAction({
    ...input.setters,
    action: async () => {
      const site = await fetchSiteDraft(input.organizationId);
      const { next, body } = mutationOf({
        organizationId: input.organizationId,
        item: input.item,
        previous: input.lastAction.current,
        kind: `canonical:${site.version}`,
      });
      input.lastAction.current = next;
      return selectCanonicalSiteDomain({ ...body, expectedSiteVersion: site.version });
    },
    onDone: () => {
      input.lastAction.current = undefined;
    },
  });
}

interface DomainWizardViewProps {
  readonly canWrite: boolean;
  readonly hostname: string;
  readonly busy: boolean;
  readonly notice: string | undefined;
  readonly items: readonly SiteDomainResponse[];
  readonly pendingRemove: SiteDomainResponse | undefined;
  readonly emptyLabel: string;
  readonly removeTitle: string;
  readonly removeConfirm: string;
  readonly cancelLabel: string;
  readonly onHostname: (value: string) => void;
  readonly onAdd: (event: FormEvent) => void;
  readonly onVerify: (item: SiteDomainResponse) => void;
  readonly onCanonical: (item: SiteDomainResponse) => void;
  readonly onAskRemove: (item: SiteDomainResponse) => void;
  readonly onCloseRemove: () => void;
  readonly onConfirmRemove: () => void;
}

function DomainWizardView(props: DomainWizardViewProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      {props.canWrite ? (
        <AddDomainForm
          hostname={props.hostname}
          busy={props.busy}
          onHostname={props.onHostname}
          onSubmit={props.onAdd}
        />
      ) : null}
      {props.notice ? <DomainNotice notice={props.notice} /> : null}
      {props.items.length === 0 ? <EmptyState message={props.emptyLabel} /> : null}
      <ul className="flex flex-col gap-4">
        {props.items.map((item) => (
          <DomainCard
            key={item.siteDomainId}
            item={item}
            canWrite={props.canWrite}
            busy={props.busy}
            onVerify={() => props.onVerify(item)}
            onCanonical={() => props.onCanonical(item)}
            onRemove={() => props.onAskRemove(item)}
          />
        ))}
      </ul>
      {props.pendingRemove ? (
        <div className="flex flex-col gap-3 rounded-md border border-default p-4">
          <p className="text-body font-semibold text-primary">{props.removeTitle}</p>
          <p className="break-all text-small text-secondary">{props.pendingRemove.hostname}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="danger" onClick={props.onConfirmRemove}>
              {props.removeConfirm}
            </Button>
            <Button type="button" variant="secondary" onClick={props.onCloseRemove}>
              {props.cancelLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

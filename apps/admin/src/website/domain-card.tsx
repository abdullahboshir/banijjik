"use client";

import { SITE_DOMAIN_STATUS, type SiteDomainResponse } from "@banijjik/contracts/website";
import { Button, FormField, TextInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { FormEvent, ReactElement } from "react";
import { DomainDnsInstructions } from "./domain-dns-instructions";

function canVerify(status: SiteDomainResponse["status"]): boolean {
  return (
    status === SITE_DOMAIN_STATUS.PENDING ||
    status === SITE_DOMAIN_STATUS.VERIFYING ||
    status === SITE_DOMAIN_STATUS.FAILED
  );
}

function canRemove(status: SiteDomainResponse["status"]): boolean {
  return status !== SITE_DOMAIN_STATUS.REMOVING && status !== SITE_DOMAIN_STATUS.REMOVED;
}

export function DomainNotice({ notice }: { readonly notice: string }): ReactElement {
  const { t } = useTranslator();
  const isError = notice !== "website.domains.saved";
  const className = isError ? "text-small text-danger" : "text-small text-secondary";
  return (
    <p role={isError ? "alert" : "status"} className={className}>
      {t(notice)}
    </p>
  );
}

export function AddDomainForm(props: {
  readonly hostname: string;
  readonly busy: boolean;
  readonly onHostname: (value: string) => void;
  readonly onSubmit: (event: FormEvent) => void;
}): ReactElement {
  const { t } = useTranslator();
  return (
    <form className="flex flex-col gap-3" onSubmit={props.onSubmit}>
      <FormField
        label={t("website.domains.hostname")}
        htmlFor="domain-hostname"
        hint={t("website.domains.hostnameHint")}
        required
      >
        <TextInput
          id="domain-hostname"
          name="hostname"
          value={props.hostname}
          onChange={(event) => props.onHostname(event.target.value)}
          autoComplete="off"
          required
        />
      </FormField>
      <Button type="submit" isLoading={props.busy}>
        {t("website.domains.add")}
      </Button>
    </form>
  );
}

export function DomainCard(props: {
  readonly item: SiteDomainResponse;
  readonly canWrite: boolean;
  readonly busy: boolean;
  readonly onVerify: () => void;
  readonly onCanonical: () => void;
  readonly onRemove: () => void;
}): ReactElement {
  const { t } = useTranslator();
  const { item } = props;
  return (
    <li className="flex flex-col gap-4 rounded-md border border-default bg-surface p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="break-all text-body font-semibold text-primary">{item.hostname}</p>
        <p className="text-small text-secondary">{t(`website.domains.status.${item.status}`)}</p>
        {item.isCanonical ? (
          <p className="text-small font-semibold text-primary">{t("website.domains.canonical")}</p>
        ) : null}
      </div>
      <DomainDnsInstructions
        title={t("website.domains.ownership")}
        records={item.ownershipRecords}
        waitLabel={t("website.domains.dnsWait")}
        copyLabel={t("website.domains.copy")}
        copiedLabel={t("website.domains.copied")}
      />
      <DomainDnsInstructions
        title={t("website.domains.certificate")}
        records={item.certificateRecords}
        waitLabel={t("website.domains.dnsWait")}
        copyLabel={t("website.domains.copy")}
        copiedLabel={t("website.domains.copied")}
      />
      {props.canWrite ? <DomainActions {...props} /> : null}
    </li>
  );
}

function DomainActions(props: {
  readonly item: SiteDomainResponse;
  readonly busy: boolean;
  readonly onVerify: () => void;
  readonly onCanonical: () => void;
  readonly onRemove: () => void;
}): ReactElement {
  const { t } = useTranslator();
  const { item } = props;
  const showCanonical = item.status === SITE_DOMAIN_STATUS.ACTIVE && !item.isCanonical;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {canVerify(item.status) ? (
        <Button type="button" variant="secondary" isLoading={props.busy} onClick={props.onVerify}>
          {t("website.domains.verify")}
        </Button>
      ) : null}
      {showCanonical ? (
        <Button
          type="button"
          variant="secondary"
          isLoading={props.busy}
          onClick={props.onCanonical}
        >
          {t("website.domains.makeCanonical")}
        </Button>
      ) : null}
      {canRemove(item.status) ? (
        <Button type="button" variant="danger" isLoading={props.busy} onClick={props.onRemove}>
          {t("website.domains.remove")}
        </Button>
      ) : null}
    </div>
  );
}

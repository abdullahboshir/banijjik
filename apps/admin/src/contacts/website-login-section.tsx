import type { CustomerAccountResponse } from "@banijjik/contracts/contact";
import type { Translator } from "@banijjik/i18n";
import { PageSection, StatusBadge } from "@banijjik/ui";
import type { ReactElement } from "react";
import { WebsiteLoginActions } from "./website-login-actions";
import { websiteLoginLabelsOf } from "./website-login-labels";

export interface WebsiteLoginSectionProps {
  organizationId: string;
  contactId: string;
  /** Absent when the contact never signed in to the business's website. */
  account: CustomerAccountResponse | undefined;
  canBlock: boolean;
  translator: Translator;
  timeZone: string;
}

function formatDate(iso: string, translator: Translator, timeZone: string): string {
  return new Intl.DateTimeFormat(translator.locale, { dateStyle: "medium", timeZone }).format(
    new Date(iso),
  );
}

function Fact(props: { label: string; children: ReactElement | string }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-small text-secondary">{props.label}</dt>
      <dd className="text-body text-primary">{props.children}</dd>
    </div>
  );
}

/** What staff see of a contact's website login (card M.1): its status and last sign-in, and Block or Unblock. */
export function WebsiteLoginSection(props: WebsiteLoginSectionProps): ReactElement {
  const { account, translator, timeZone } = props;
  const { t } = translator;
  const title = t("contacts.login.title");
  const help = t("contacts.login.help");
  if (account === undefined) {
    return (
      <PageSection title={title} help={help}>
        <p className="text-body text-secondary">{t("contacts.login.none")}</p>
      </PageSection>
    );
  }
  const change = account.status === "ACTIVE" ? "block" : "unblock";
  return (
    <PageSection
      title={title}
      help={help}
      action={
        props.canBlock ? (
          <WebsiteLoginActions
            organizationId={props.organizationId}
            contactId={props.contactId}
            version={account.version}
            change={change}
            buttonLabel={t(`contacts.login.${change}`)}
            labels={websiteLoginLabelsOf(t)}
          />
        ) : null
      }
    >
      <dl className="grid gap-4 md:grid-cols-3">
        <Fact label={t("contacts.login.status")}>
          <StatusBadge
            requestType="CONTACT"
            status={account.status}
            label={t(`contacts.login.status.${account.status}`)}
          />
        </Fact>
        {account.verifiedAt ? (
          <Fact label={t("contacts.login.firstSignIn")}>
            {formatDate(account.verifiedAt, translator, timeZone)}
          </Fact>
        ) : null}
        {account.lastLoginAt ? (
          <Fact label={t("contacts.login.lastSignIn")}>
            {formatDate(account.lastLoginAt, translator, timeZone)}
          </Fact>
        ) : null}
      </dl>
    </PageSection>
  );
}

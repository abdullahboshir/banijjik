"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";
import { Sheet, SheetContent } from "./sheet.js";

export interface AccountMenuOrganization {
  organizationId: string;
  name: string;
  href: string;
  isCurrent: boolean;
}

export interface AccountMenuLanguage {
  localeKey: string;
  label: string;
  isCurrent: boolean;
}

export interface AccountMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  userName: string;
  organizationsHeading: string;
  organizations: AccountMenuOrganization[];
  languageHeading: string;
  languages: AccountMenuLanguage[];
  onLocaleChange: (localeKey: string) => void;
  signOutLabel: string;
  onSignOut: () => void;
  /** Optional "Approval PIN" block for managers (card 3.4b). */
  approvalPinSection?: ReactNode;
}

const SECTION_HEADING_CLASS = "text-small font-semibold text-secondary";

/** Plain anchors on purpose: switching business is a full page load (ADR-022), never a client navigation. */
function OrganizationLinks({
  organizations,
}: {
  organizations: AccountMenuOrganization[];
}): ReactElement {
  return (
    <ul className="flex flex-col gap-1">
      {organizations.map((organization) => (
        <li key={organization.organizationId}>
          <a
            href={organization.href}
            aria-current={organization.isCurrent ? "true" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-md px-3 text-body text-primary transition-colors hover:bg-subtle",
              organization.isCurrent && "bg-subtle font-semibold",
            )}
          >
            {organization.name}
          </a>
        </li>
      ))}
    </ul>
  );
}

function LanguageButtons({
  languages,
  onLocaleChange,
}: Pick<AccountMenuProps, "languages" | "onLocaleChange">): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {languages.map((language) => (
        <Button
          key={language.localeKey}
          variant={language.isCurrent ? "primary" : "secondary"}
          aria-pressed={language.isCurrent}
          onClick={() => onLocaleChange(language.localeKey)}
        >
          {language.label}
        </Button>
      ))}
    </div>
  );
}

/** The account sheet: the person, their businesses (full-reload links), the language and sign out. Text arrives as props. */
export function AccountMenu(props: AccountMenuProps): ReactElement {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent title={props.title} closeLabel={props.closeLabel}>
        <p className="text-body font-semibold text-primary">{props.userName}</p>
        <section className="flex flex-col gap-2">
          <h3 className={SECTION_HEADING_CLASS}>{props.organizationsHeading}</h3>
          <OrganizationLinks organizations={props.organizations} />
        </section>
        <section className="flex flex-col gap-2">
          <h3 className={SECTION_HEADING_CLASS}>{props.languageHeading}</h3>
          <LanguageButtons languages={props.languages} onLocaleChange={props.onLocaleChange} />
        </section>
        {props.approvalPinSection}
        <Button variant="secondary" className="w-full" onClick={props.onSignOut}>
          {props.signOutLabel}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

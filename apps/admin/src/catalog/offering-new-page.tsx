import { OFFERING_KIND, PERMISSION_KEY, type OfferingKind } from "@banijjik/contracts";
import { EmptyState, PageLayout, PageSection } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { loadCatalogLookups } from "./catalog-lookups";
import { kindWord, type CatalogWordSource } from "./catalog-words";
import { buildEditorProps } from "./editor-props";
import { LazyOfferingEditor } from "./lazy-offering-editor";

function chosenKind(
  kinds: readonly OfferingKind[],
  raw: string | string[] | undefined,
): OfferingKind | undefined {
  const asked = Array.isArray(raw) ? raw[0] : raw;
  const candidate = Object.values(OFFERING_KIND).find((kind) => kind === asked);
  if (candidate && kinds.includes(candidate)) return candidate;
  return kinds.length === 1 ? kinds[0] : undefined;
}

function KindCards(props: { words: CatalogWordSource; orgSlug: string }): ReactElement {
  const { words, orgSlug } = props;
  const { t } = words.translator;
  return (
    <PageSection title={t("catalog.section.kind.title")} help={t("catalog.section.kind.help")}>
      <ul className="grid gap-3 md:grid-cols-2">
        {words.kinds.map((kind) => (
          <li key={kind}>
            <Link
              href={`/${orgSlug}/catalog/new?kind=${kind}`}
              className="flex min-h-11 flex-col gap-1 rounded-md border border-default bg-surface p-4"
            >
              <span className="text-title font-semibold text-primary">{kindWord(words, kind)}</span>
              <span className="text-small text-secondary">{t(`catalog.kindHelp.${kind}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

/** `/{orgSlug}/catalog/new?kind=`: the kind cards when the business has several, then the form. */
export async function OfferingNewPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions, kinds, terms } = access.config;
  const canCreate =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.CATALOG_OFFERING_CREATE);
  if (!canCreate || kinds.length === 0) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const words: CatalogWordSource = { terms, kinds, translator };
  const kind = chosenKind(kinds, searchParams["kind"]);
  if (kind === undefined) {
    return (
      <PageLayout title={t("catalog.title")}>
        <KindCards words={words} orgSlug={orgSlug} />
      </PageLayout>
    );
  }
  const lookups = await loadCatalogLookups(access);
  const editor = buildEditorProps({ access, translator, lookups, kind, offering: undefined });
  return (
    <PageLayout title={t("catalog.editor.newTitle", { kind: editor.kindWord })}>
      <LazyOfferingEditor {...editor} canWrite />
    </PageLayout>
  );
}

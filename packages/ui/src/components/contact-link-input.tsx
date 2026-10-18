import { useEffect, useState, type ReactElement } from "react";
import { Button } from "./button.js";
import { TextInput } from "./form.js";

/** One existing contact the person can link. */
export interface ContactLinkCandidate {
  readonly contactId: string;
  readonly name: string;
  readonly phone: string | undefined;
}

export interface ContactLinkLabels {
  /** Placeholder and accessible name of the search box. */
  readonly search: string;
  readonly noResults: string;
  readonly createNew: string;
  readonly name: string;
  readonly phone: string;
  readonly change: string;
  readonly remove: string;
  /** Said while a contact is linked, with `{name}` for the contact's name. */
  readonly linked: string;
  /** Said while a new contact will be made from the typed name and phone. */
  readonly willCreate: string;
}

/** What the input stores: an existing contact's id, or the name and phone of a contact to create (ADR-073). */
export type ContactLinkValue =
  string | { readonly create: { readonly name: string; readonly phone: string } };

export interface ContactLinkInputProps {
  readonly id: string;
  readonly value: unknown;
  readonly onChange: (value: ContactLinkValue | null) => void;
  /** Finds existing contacts by name or phone; the caller owns the API call. */
  readonly search: (query: string) => Promise<readonly ContactLinkCandidate[]>;
  /** The name of an already linked contact, when the caller knows it. */
  readonly nameOf?: ((contactId: string) => string | undefined) | undefined;
  readonly labels: ContactLinkLabels;
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly isRequired?: boolean | undefined;
}

const SEARCH_DELAY_MS = 250;
const MIN_QUERY_LENGTH = 2;

interface CreateDraft {
  name: string;
  phone: string;
}

function isCreateValue(value: unknown): value is { create: CreateDraft } {
  return typeof value === "object" && value !== null && "create" in value;
}

function fill(template: string, name: string): string {
  return template.replace("{name}", name);
}

function useCandidates(
  search: ContactLinkInputProps["search"],
  query: string,
): { candidates: readonly ContactLinkCandidate[]; isSearching: boolean } {
  const [candidates, setCandidates] = useState<readonly ContactLinkCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH) {
      setCandidates([]);
      return undefined;
    }
    let isCurrent = true;
    async function run(): Promise<void> {
      setIsSearching(true);
      try {
        const found = await search(text);
        if (isCurrent) setCandidates(found);
      } catch {
        // A failed search shows "no results"; the person can still create the contact.
        if (isCurrent) setCandidates([]);
      } finally {
        if (isCurrent) setIsSearching(false);
      }
    }
    const timer = setTimeout(() => void run(), SEARCH_DELAY_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [search, query]);
  return { candidates, isSearching };
}

function LinkedNote(props: {
  readonly text: string;
  readonly labels: ContactLinkLabels;
  readonly disabled: boolean;
  readonly isRequired: boolean;
  readonly onChange: () => void;
  readonly onRemove: () => void;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="break-words text-body text-primary">{props.text}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={props.disabled} onClick={props.onChange}>
          {props.labels.change}
        </Button>
        {props.isRequired ? null : (
          <Button variant="secondary" disabled={props.disabled} onClick={props.onRemove}>
            {props.labels.remove}
          </Button>
        )}
      </div>
    </div>
  );
}

function NewContactFields(props: {
  readonly id: string;
  readonly labels: ContactLinkLabels;
  readonly disabled: boolean;
  readonly draft: CreateDraft;
  readonly onDraft: (draft: CreateDraft) => void;
}): ReactElement {
  const { draft, labels } = props;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <TextInput
        id={`${props.id}-new-name`}
        aria-label={labels.name}
        placeholder={labels.name}
        autoComplete="off"
        disabled={props.disabled}
        value={draft.name}
        onChange={(event) => props.onDraft({ ...draft, name: event.target.value })}
      />
      <TextInput
        id={`${props.id}-new-phone`}
        aria-label={labels.phone}
        placeholder={labels.phone}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        disabled={props.disabled}
        value={draft.phone}
        onChange={(event) => props.onDraft({ ...draft, phone: event.target.value })}
      />
      <p className="text-small text-secondary">{labels.willCreate}</p>
    </div>
  );
}

function SearchResults(props: {
  readonly candidates: readonly ContactLinkCandidate[];
  readonly query: string;
  readonly isSearching: boolean;
  readonly labels: ContactLinkLabels;
  readonly onPick: (candidate: ContactLinkCandidate) => void;
}): ReactElement | null {
  if (props.query.trim().length < MIN_QUERY_LENGTH) return null;
  if (props.candidates.length === 0) {
    return props.isSearching ? null : (
      <p className="text-small text-secondary">{props.labels.noResults}</p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {props.candidates.map((candidate) => (
        <li key={candidate.contactId}>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-default bg-surface px-3 text-start text-body text-primary"
            onClick={() => props.onPick(candidate)}
          >
            <span className="min-w-0 break-words">{candidate.name}</span>
            {candidate.phone ? (
              <span className="shrink-0 text-small text-secondary">{candidate.phone}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface LinkState {
  readonly query: string;
  readonly isCreating: boolean;
  readonly pickedName: string | undefined;
  readonly draft: CreateDraft;
  readonly setQuery: (query: string) => void;
  readonly clear: () => void;
  readonly changeDraft: (draft: CreateDraft) => void;
  readonly toggleCreating: () => void;
  readonly pick: (candidate: ContactLinkCandidate) => void;
  readonly editNew: (draft: CreateDraft) => void;
}

/** The input's own state: what is typed, whether a new contact is being typed, and what was picked. */
function useLinkState(onChange: ContactLinkInputProps["onChange"]): LinkState {
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pickedName, setPickedName] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<CreateDraft>({ name: "", phone: "" });
  return {
    query,
    isCreating,
    pickedName,
    draft,
    setQuery,
    clear: () => {
      setPickedName(undefined);
      setDraft({ name: "", phone: "" });
      setQuery("");
      setIsCreating(false);
      onChange(null);
    },
    changeDraft: (next) => {
      setDraft(next);
      const isComplete = next.name.trim() !== "" && next.phone.trim() !== "";
      onChange(
        isComplete ? { create: { name: next.name.trim(), phone: next.phone.trim() } } : null,
      );
    },
    toggleCreating: () => {
      if (isCreating) onChange(null);
      setIsCreating(!isCreating);
    },
    pick: (candidate) => {
      setPickedName(candidate.name);
      onChange(candidate.contactId);
    },
    editNew: (next) => {
      setDraft(next);
      setIsCreating(true);
    },
  };
}

/** The sentence for a linked contact, or undefined while nothing is linked. */
function linkedTextOf(props: ContactLinkInputProps, state: LinkState): string | undefined {
  const { value, labels } = props;
  if (typeof value === "string" && value !== "") {
    return fill(labels.linked, state.pickedName ?? props.nameOf?.(value) ?? value);
  }
  if (isCreateValue(value) && !state.isCreating) return fill(labels.linked, value.create.name);
  return undefined;
}

function Picker(props: {
  readonly input: ContactLinkInputProps;
  readonly state: LinkState;
}): ReactElement {
  const { input, state } = props;
  const disabled = input.disabled === true;
  const { candidates, isSearching } = useCandidates(
    input.search,
    state.isCreating ? "" : state.query,
  );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {state.isCreating ? (
        <NewContactFields
          id={input.id}
          labels={input.labels}
          disabled={disabled}
          draft={state.draft}
          onDraft={state.changeDraft}
        />
      ) : (
        <>
          <TextInput
            id={input.id}
            type="search"
            aria-label={input.labels.search}
            placeholder={input.labels.search}
            autoComplete="off"
            disabled={disabled}
            value={state.query}
            onChange={(event) => state.setQuery(event.target.value)}
            {...(input.error ? { "aria-invalid": true as const } : {})}
          />
          <SearchResults
            candidates={candidates}
            query={state.query}
            isSearching={isSearching}
            labels={input.labels}
            onPick={state.pick}
          />
        </>
      )}
      <Button variant="secondary" disabled={disabled} onClick={state.toggleCreating}>
        {state.isCreating ? input.labels.search : input.labels.createNew}
      </Button>
    </div>
  );
}

/**
 * Links a contact to a field: finds an existing contact by name or phone, or takes a name and a phone for
 * a new one (ADR-073). It reports the id of the chosen contact, or `{ create: { name, phone } }`; the
 * server links the contact with that phone or creates it. The package has no API knowledge: the caller
 * passes the search.
 */
export function ContactLinkInput(props: ContactLinkInputProps): ReactElement {
  const state = useLinkState(props.onChange);
  const linkedText = linkedTextOf(props, state);
  if (linkedText === undefined) return <Picker input={props} state={state} />;
  const { value } = props;
  return (
    <LinkedNote
      text={linkedText}
      labels={props.labels}
      disabled={props.disabled === true}
      isRequired={props.isRequired === true}
      onChange={isCreateValue(value) ? () => state.editNew(value.create) : state.clear}
      onRemove={state.clear}
    />
  );
}

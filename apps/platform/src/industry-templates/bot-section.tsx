"use client";

import type {
  IndustryTemplateConfiguration,
  IndustryTemplateKnowledgeStarter,
} from "@banijjik/contracts";
import { Button, FormField, Textarea, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { IndustrySection } from "./industry-section";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import type { TemplatePatch } from "./use-template-save";

function linesOf(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function BotSection({
  configuration,
  canWrite,
  labels,
  onSave,
}: {
  configuration: IndustryTemplateConfiguration;
  canWrite: boolean;
  labels: IndustryLabels;
  onSave: (patch: TemplatePatch) => void;
}): ReactElement {
  const t = labelsTranslator(labels);
  const [personaKey, setPersonaKey] = useState(configuration.botDefaults.personaKey);
  const [handoff, setHandoff] = useState(configuration.botDefaults.handoffTopics.join("\n"));
  const [websites, setWebsites] = useState(configuration.websiteTemplateKeys.join("\n"));
  const [starters, setStarters] = useState<IndustryTemplateKnowledgeStarter[]>([
    ...configuration.knowledgeSeed,
  ]);

  function save(): void {
    onSave({
      configuration: {
        ...configuration,
        botDefaults: { personaKey, handoffTopics: linesOf(handoff) },
        websiteTemplateKeys: linesOf(websites),
        knowledgeSeed: starters,
      },
    });
  }

  return (
    <IndustrySection title={t("platform.industry.section.bot")}>
      <BotTextFields
        canWrite={canWrite}
        personaLabel={t("platform.industry.field.personaKey")}
        handoffLabel={t("platform.industry.field.handoffTopics")}
        websiteLabel={t("platform.industry.field.websiteKeys")}
        personaKey={personaKey}
        handoff={handoff}
        websites={websites}
        onPersona={setPersonaKey}
        onHandoff={setHandoff}
        onWebsites={setWebsites}
      />
      <KnowledgeList
        starters={starters}
        canWrite={canWrite}
        draft={t("platform.industry.knowledge.draft")}
        addLabel={t("platform.industry.action.addKnowledge")}
        onChange={setStarters}
      />
      {canWrite ? (
        <Button id="save-bot" onClick={save}>
          {t("platform.industry.action.save")}
        </Button>
      ) : null}
    </IndustrySection>
  );
}

function BotTextFields(props: {
  canWrite: boolean;
  personaLabel: string;
  handoffLabel: string;
  websiteLabel: string;
  personaKey: string;
  handoff: string;
  websites: string;
  onPersona: (value: string) => void;
  onHandoff: (value: string) => void;
  onWebsites: (value: string) => void;
}): ReactElement {
  return (
    <>
      <FormField label={props.personaLabel} htmlFor="bot-persona">
        <TextInput
          id="bot-persona"
          value={props.personaKey}
          disabled={!props.canWrite}
          onChange={(event) => props.onPersona(event.target.value)}
        />
      </FormField>
      <FormField label={props.handoffLabel} htmlFor="bot-handoff">
        <Textarea
          id="bot-handoff"
          value={props.handoff}
          disabled={!props.canWrite}
          onChange={(event) => props.onHandoff(event.target.value)}
        />
      </FormField>
      <FormField label={props.websiteLabel} htmlFor="bot-websites">
        <Textarea
          id="bot-websites"
          value={props.websites}
          disabled={!props.canWrite}
          onChange={(event) => props.onWebsites(event.target.value)}
        />
      </FormField>
    </>
  );
}

function KnowledgeList(props: {
  starters: readonly IndustryTemplateKnowledgeStarter[];
  canWrite: boolean;
  draft: string;
  addLabel: string;
  onChange: (starters: IndustryTemplateKnowledgeStarter[]) => void;
}): ReactElement {
  return (
    <>
      {props.starters.map((starter, index) => (
        <KnowledgeRow
          key={`${starter.topicKey}-${index}`}
          starter={starter}
          canWrite={props.canWrite}
          onChange={(next) =>
            props.onChange(
              props.starters.map((item, itemIndex) => (itemIndex === index ? next : item)),
            )
          }
        />
      ))}
      {props.canWrite ? (
        <Button
          id="add-knowledge"
          variant="secondary"
          onClick={() =>
            props.onChange([
              ...props.starters,
              { topicKey: "NEW_TOPIC", answer: { bn: props.draft, en: props.draft } },
            ])
          }
        >
          {props.addLabel}
        </Button>
      ) : null}
    </>
  );
}

function KnowledgeRow(props: {
  starter: IndustryTemplateKnowledgeStarter;
  canWrite: boolean;
  onChange: (starter: IndustryTemplateKnowledgeStarter) => void;
}): ReactElement {
  const { starter } = props;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <TextInput
        id={`knowledge-${starter.topicKey}-key`}
        value={starter.topicKey}
        disabled={!props.canWrite}
        onChange={(event) => props.onChange({ ...starter, topicKey: event.target.value })}
      />
      <TextInput
        id={`knowledge-${starter.topicKey}-bn`}
        value={starter.answer.bn}
        disabled={!props.canWrite}
        onChange={(event) =>
          props.onChange({ ...starter, answer: { ...starter.answer, bn: event.target.value } })
        }
      />
      <TextInput
        id={`knowledge-${starter.topicKey}-en`}
        value={starter.answer.en}
        disabled={!props.canWrite}
        onChange={(event) =>
          props.onChange({ ...starter, answer: { ...starter.answer, en: event.target.value } })
        }
      />
    </div>
  );
}

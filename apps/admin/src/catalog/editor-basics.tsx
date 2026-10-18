"use client";

import type { CategoryResponse } from "@banijjik/contracts/catalog";
import { FormField, PageSection, Textarea } from "@banijjik/ui";
import type { ReactElement } from "react";
import { TextField, ToggleField, type SectionProps } from "./editor-fields";
import { EditorImages, type ImageUploader } from "./editor-images";

export interface BasicsProps extends SectionProps {
  categories: readonly Pick<CategoryResponse, "categoryId" | "name">[];
  uploader: ImageUploader;
}

function toggled(ids: readonly string[], id: string, isOn: boolean): string[] {
  return isOn ? [...ids, id] : ids.filter((candidate) => candidate !== id);
}

function CategoryPicker(props: BasicsProps): ReactElement {
  const { categories, form, labels, update, isReadOnly } = props;
  if (categories.length === 0) {
    return <p className="text-small text-secondary">{labels["field.noCategories"]}</p>;
  }
  return (
    <fieldset className="flex flex-col">
      <legend className="text-small font-semibold text-primary">
        {labels["field.categories"]}
      </legend>
      <p className="text-small text-secondary">{labels["field.categoriesHint"]}</p>
      {categories.map((category) => (
        <ToggleField
          key={category.categoryId}
          label={category.name}
          checked={form.categoryIds.includes(category.categoryId)}
          disabled={isReadOnly}
          onChange={(isOn) =>
            update({ categoryIds: toggled(form.categoryIds, category.categoryId, isOn) })
          }
        />
      ))}
    </fieldset>
  );
}

/** Name, description, categories and photos. */
export function EditorBasics(props: BasicsProps): ReactElement {
  const { form, labels, update, errors, isReadOnly } = props;
  return (
    <PageSection title={labels["section.basics.title"]} help={labels["section.basics.help"]}>
      <TextField
        id="offering-name"
        label={labels["field.name"]}
        value={form.name}
        error={errors["name"]}
        disabled={isReadOnly}
        onChange={(name) => update({ name })}
      />
      <FormField label={labels["field.description"]} htmlFor="offering-description">
        <Textarea
          id="offering-description"
          value={form.description}
          disabled={isReadOnly}
          onChange={(event) => update({ description: event.target.value })}
        />
      </FormField>
      <CategoryPicker {...props} />
      <EditorImages
        images={form.images}
        labels={labels}
        uploader={props.uploader}
        isReadOnly={isReadOnly}
        onChange={(images) => update({ images })}
      />
    </PageSection>
  );
}

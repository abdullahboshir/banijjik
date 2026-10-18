"use client";

import type { CategoryResponse } from "@banijjik/contracts/catalog";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import {
  allowedParents,
  canHaveChildren,
  moveAmongSiblings,
  treeRows,
  type TreeRow,
} from "./category-tree";
import { fillLabel } from "./catalog-labels";
import type { CategoryLabels } from "./manager-labels";
import { archiveCategory, createCategory, updateCategory } from "./record-api";
import { useRecordAction, type RecordAction } from "./use-record-action";

export interface CategoriesManagerProps {
  organizationId: string;
  categories: CategoryResponse[];
  labels: CategoryLabels;
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
}

const TOP_LEVEL = "";

function FailureLine(props: { action: RecordAction; labels: CategoryLabels }): ReactElement | null {
  const { t } = useTranslator();
  const { failure } = props.action;
  if (!failure) return null;
  if (failure.isConflict) {
    return (
      <div role="alert" className="flex flex-col gap-2 text-small text-danger">
        <p>{props.labels["categories.conflict"]}</p>
        <Button variant="secondary" onClick={props.action.reload}>
          {props.labels["categories.reload"]}
        </Button>
      </div>
    );
  }
  return (
    <p role="alert" className="text-small text-danger">
      {t(knownMessageKeyOrInternal(failure.messageKey ?? "errors.internal"))}
    </p>
  );
}

function ParentSelect(props: {
  id: string;
  label: string;
  topLevel: string;
  value: string;
  parents: readonly Pick<CategoryResponse, "categoryId" | "name">[];
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.id}>
      <Select id={props.id} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        <option value={TOP_LEVEL}>{props.topLevel}</option>
        {props.parents.map((parent) => (
          <option key={parent.categoryId} value={parent.categoryId}>
            {parent.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function AddCategory(props: CategoriesManagerProps & { action: RecordAction }): ReactElement {
  const { labels, categories, organizationId, action } = props;
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(TOP_LEVEL);
  const parents = categories.filter((item) => canHaveChildren(categories, item.categoryId));
  async function add(): Promise<void> {
    if (name.trim() === "") return;
    const done = await action.run(() =>
      createCategory(organizationId, {
        name: name.trim(),
        ...(parentId === TOP_LEVEL ? {} : { parentCategoryId: parentId }),
      }),
    );
    if (done) setName("");
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <FormField label={labels["categories.name"]} htmlFor="new-category-name">
        <TextInput
          id="new-category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <ParentSelect
        id="new-category-parent"
        label={labels["categories.parent"]}
        topLevel={labels["categories.topLevel"]}
        value={parentId}
        parents={parents}
        onChange={setParentId}
      />
      <Button isLoading={action.isBusy} onClick={() => void add()}>
        {labels["categories.add"]}
      </Button>
    </div>
  );
}

function EditButtons(props: {
  labels: CategoryLabels;
  action: RecordAction;
  canArchive: boolean;
  onSave: () => void;
  onArchive: () => void;
  onClose: () => void;
}): ReactElement {
  const { labels, action } = props;
  return (
    <div className="flex flex-wrap gap-2">
      <Button isLoading={action.isBusy} onClick={props.onSave}>
        {labels["categories.save"]}
      </Button>
      {props.canArchive ? (
        <Button variant="secondary" disabled={action.isBusy} onClick={props.onArchive}>
          {labels["categories.archive"]}
        </Button>
      ) : null}
      <Button variant="secondary" onClick={props.onClose}>
        {labels["categories.close"]}
      </Button>
    </div>
  );
}

function EditPanel(props: {
  row: TreeRow<CategoryResponse>;
  all: CategoryResponse[];
  manager: CategoriesManagerProps;
  action: RecordAction;
  onClose: () => void;
}): ReactElement {
  const { row, all, manager, action } = props;
  const { labels } = manager;
  const [name, setName] = useState(row.category.name);
  const [parentId, setParentId] = useState(row.category.parentCategoryId ?? TOP_LEVEL);
  const base = { categoryId: row.category.categoryId, version: row.category.version };
  async function save(): Promise<void> {
    const done = await action.run(() =>
      updateCategory(manager.organizationId, {
        ...base,
        changes: {
          name: name.trim(),
          parentCategoryId: parentId === TOP_LEVEL ? null : parentId,
        },
      }),
    );
    if (done) props.onClose();
  }
  return (
    <div className="flex flex-col gap-3 border-t border-default pt-3">
      <FormField label={labels["categories.name"]} htmlFor={`category-name-${base.categoryId}`}>
        <TextInput
          id={`category-name-${base.categoryId}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <ParentSelect
        id={`category-parent-${base.categoryId}`}
        label={labels["categories.parent"]}
        topLevel={labels["categories.topLevel"]}
        value={parentId}
        parents={allowedParents(all, base.categoryId)}
        onChange={setParentId}
      />
      <EditButtons
        labels={labels}
        action={action}
        canArchive={manager.canArchive}
        onSave={() => void save()}
        onArchive={() => void action.run(() => archiveCategory(manager.organizationId, base))}
        onClose={props.onClose}
      />
    </div>
  );
}

function RowButtons(props: {
  labels: CategoryLabels;
  isBusy: boolean;
  onMove: (offset: -1 | 1) => void;
  onEdit: () => void;
}): ReactElement {
  const { labels } = props;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={props.isBusy} onClick={() => props.onMove(-1)}>
        {labels["categories.moveUp"]}
      </Button>
      <Button variant="secondary" disabled={props.isBusy} onClick={() => props.onMove(1)}>
        {labels["categories.moveDown"]}
      </Button>
      <Button variant="secondary" onClick={props.onEdit}>
        {labels["categories.edit"]}
      </Button>
    </div>
  );
}

function CategoryRow(props: {
  row: TreeRow<CategoryResponse>;
  manager: CategoriesManagerProps;
  action: RecordAction;
}): ReactElement {
  const { row, manager, action } = props;
  const { labels, categories } = manager;
  const [isEditing, setIsEditing] = useState(false);
  const { categoryId } = row.category;
  function move(offset: -1 | 1): void {
    const changes = moveAmongSiblings(categories, categoryId, offset);
    void action.run(() =>
      Promise.all(
        changes.map((change) =>
          updateCategory(manager.organizationId, {
            categoryId: change.categoryId,
            version: categories.find((item) => item.categoryId === change.categoryId)?.version ?? 0,
            changes: { sortOrder: change.sortOrder },
          }),
        ),
      ),
    );
  }
  return (
    <li
      className="flex flex-col gap-2 rounded-md border border-default bg-surface p-3"
      style={{ marginInlineStart: `${(row.depth - 1) * 1.5}rem` }}
      aria-label={fillLabel(labels["categories.rowLabel"], {
        name: row.category.name,
        depth: row.depth,
      })}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words text-body font-semibold text-primary">
          {row.category.name}
        </span>
        {manager.canUpdate ? (
          <RowButtons
            labels={labels}
            isBusy={action.isBusy}
            onMove={move}
            onEdit={() => setIsEditing(!isEditing)}
          />
        ) : null}
      </div>
      {isEditing ? (
        <EditPanel
          row={row}
          all={categories}
          manager={manager}
          action={action}
          onClose={() => setIsEditing(false)}
        />
      ) : null}
    </li>
  );
}

/** The category tree: an indented list with add, rename, move, order and archive (plan 3.2b, section 4). */
export function CategoriesManager(props: CategoriesManagerProps): ReactElement {
  const action = useRecordAction();
  const rows = treeRows(props.categories);
  return (
    <div className="flex flex-col gap-4">
      {props.canCreate ? <AddCategory {...props} action={action} /> : null}
      <FailureLine action={action} labels={props.labels} />
      {rows.length === 0 ? (
        <p className="text-body text-secondary">{props.labels["categories.empty"]}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <CategoryRow key={row.category.categoryId} row={row} manager={props} action={action} />
          ))}
        </ul>
      )}
    </div>
  );
}

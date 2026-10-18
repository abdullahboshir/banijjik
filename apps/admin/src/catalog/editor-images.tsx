"use client";

import { MAX_OFFERING_IMAGES } from "@banijjik/contracts/catalog";
import { Button, ImageInput, PublicImage } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { fillLabel, type EditorLabels } from "./catalog-labels";
import type { ImageState } from "./offering-form";

export interface ImageUploader {
  /** Uploads one picked file and gives back its id and the address to show. */
  upload: (file: File) => Promise<ImageState>;
}

export interface EditorImagesProps {
  images: readonly ImageState[];
  labels: EditorLabels;
  uploader: ImageUploader;
  isReadOnly: boolean;
  onChange: (images: ImageState[]) => void;
}

function moved(images: readonly ImageState[], index: number, offset: number): ImageState[] {
  const next = [...images];
  const [item] = next.splice(index, 1);
  if (item === undefined) return next;
  next.splice(index + offset, 0, item);
  return next;
}

function ImageRow(props: {
  image: ImageState;
  index: number;
  count: number;
  labels: EditorLabels;
  onMove: (offset: number) => void;
  onRemove: () => void;
}): ReactElement {
  const { image, index, count, labels } = props;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-sm border border-default p-2">
      <PublicImage
        src={image.url}
        alt={labels["image.alt"]}
        className="size-14 shrink-0 rounded-sm object-cover"
      />
      <span className="min-w-0 flex-1 text-small text-secondary">
        {index === 0 ? labels["image.cover"] : ""}
      </span>
      <Button variant="secondary" disabled={index === 0} onClick={() => props.onMove(-1)}>
        {labels["image.moveUp"]}
      </Button>
      <Button variant="secondary" disabled={index === count - 1} onClick={() => props.onMove(1)}>
        {labels["image.moveDown"]}
      </Button>
      <Button variant="secondary" onClick={props.onRemove}>
        {labels["image.remove"]}
      </Button>
    </li>
  );
}

/** The photos of an offering: the first one is the cover. Reordering uses buttons, which also work on a phone. */
export function EditorImages(props: EditorImagesProps): ReactElement {
  const { images, labels, uploader, isReadOnly, onChange } = props;
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const isFull = images.length >= MAX_OFFERING_IMAGES;

  async function pick(file: File): Promise<void> {
    setIsUploading(true);
    setError(undefined);
    try {
      onChange([...images, await uploader.upload(file)]);
    } catch {
      setError(labels["error.generic"]);
    }
    setIsUploading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-small font-semibold text-primary">{labels["field.images"]}</p>
      <p className="text-small text-secondary">{labels["field.imagesHint"]}</p>
      <ul className="flex flex-col gap-2">
        {images.map((image, index) => (
          <ImageRow
            key={image.fileId}
            image={image}
            index={index}
            count={images.length}
            labels={labels}
            onMove={(offset) => onChange(moved(images, index, offset))}
            onRemove={() => onChange(images.filter((candidate) => candidate !== image))}
          />
        ))}
      </ul>
      {isFull ? (
        <p className="text-small text-secondary">
          {fillLabel(labels["image.limit"], { count: MAX_OFFERING_IMAGES })}
        </p>
      ) : (
        <ImageInput
          id="offering-image"
          previewUrl={undefined}
          isUploading={isUploading}
          disabled={isReadOnly}
          error={error}
          onPick={(file) => void pick(file)}
          labels={{
            choose: labels["image.choose"],
            change: labels["image.change"],
            remove: labels["image.remove"],
            uploading: labels["image.uploading"],
            previewAlt: labels["image.alt"],
          }}
        />
      )}
    </div>
  );
}

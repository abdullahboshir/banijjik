import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CustomFieldInputs } from "./custom-field-inputs.js";
import type { CustomFieldFileSupport } from "./custom-field-types.js";
import { FileInput, type FileInputLabels } from "./file-input.js";
import { ImageInput, type ImageInputLabels } from "./image-input.js";

const IMAGE_LABELS: ImageInputLabels = {
  choose: "Choose image",
  change: "Change image",
  remove: "Remove image",
  uploading: "Uploading",
  previewAlt: "Shop photo",
};

const FILE_LABELS: FileInputLabels = {
  choose: "Choose PDF",
  change: "Change PDF",
  remove: "Remove PDF",
  uploading: "Uploading",
  attached: "PDF attached",
};

function aPicture(): File {
  return new File([new Uint8Array([1, 2, 3])], "shop.png", { type: "image/png" });
}

describe("ImageInput", () => {
  it("passes the chosen file to onPick", async () => {
    const onPick = vi.fn();
    render(
      <ImageInput
        id="photo"
        previewUrl={undefined}
        onPick={onPick}
        isUploading={false}
        labels={IMAGE_LABELS}
      />,
    );
    const file = aPicture();

    await userEvent.upload(document.querySelector("input#photo") as HTMLInputElement, file);

    expect(onPick).toHaveBeenCalledWith(file);
  });

  it("offers only the three image types the API accepts", () => {
    render(
      <ImageInput
        id="photo"
        previewUrl={undefined}
        onPick={vi.fn()}
        isUploading={false}
        labels={IMAGE_LABELS}
      />,
    );

    expect(document.querySelector("input#photo")?.getAttribute("accept")).toBe(
      "image/jpeg,image/png,image/webp",
    );
  });

  it("shows the preview and a Change button once an image is chosen", () => {
    render(
      <ImageInput
        id="photo"
        previewUrl="https://api.example.com/p.webp"
        onPick={vi.fn()}
        onClear={vi.fn()}
        isUploading={false}
        labels={IMAGE_LABELS}
      />,
    );

    expect(screen.getByAltText("Shop photo").getAttribute("src")).toBe(
      "https://api.example.com/p.webp",
    );
    expect(screen.getByRole("button", { name: "Change image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove image" })).toBeTruthy();
  });

  it("disables the buttons and says Uploading while the upload runs", () => {
    render(
      <ImageInput
        id="photo"
        previewUrl={undefined}
        onPick={vi.fn()}
        isUploading
        labels={IMAGE_LABELS}
      />,
    );

    const button = screen.getByRole("button", { name: "Uploading" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("links the error to the input for screen readers", () => {
    render(
      <ImageInput
        id="photo"
        previewUrl={undefined}
        onPick={vi.fn()}
        isUploading={false}
        error="Too large"
        labels={IMAGE_LABELS}
      />,
    );

    const input = document.querySelector("input#photo");
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect(input?.getAttribute("aria-describedby")).toBe("photo-error");
  });

  it("keeps the touch target at least 44 px high", () => {
    render(
      <ImageInput
        id="photo"
        previewUrl={undefined}
        onPick={vi.fn()}
        isUploading={false}
        labels={IMAGE_LABELS}
      />,
    );

    expect(screen.getByRole("button", { name: "Choose image" }).className).toContain("min-h-11");
  });
});

describe("FileInput", () => {
  it("passes the chosen PDF to onPick and accepts only PDFs in the dialog", async () => {
    const onPick = vi.fn();
    render(
      <FileInput
        id="scan"
        hasFile={false}
        onPick={onPick}
        isUploading={false}
        labels={FILE_LABELS}
      />,
    );
    const file = new File([new Uint8Array([1])], "licence.pdf", { type: "application/pdf" });

    await userEvent.upload(document.querySelector("input#scan") as HTMLInputElement, file);

    expect(onPick).toHaveBeenCalledWith(file);
    expect(document.querySelector("input#scan")?.getAttribute("accept")).toBe("application/pdf");
  });

  it("says a file is attached and links to it when the caller gives a link", () => {
    render(
      <FileInput
        id="scan"
        hasFile
        href="https://api.example.com/f"
        onPick={vi.fn()}
        isUploading={false}
        labels={FILE_LABELS}
      />,
    );

    expect(screen.getByRole("link", { name: "PDF attached" }).getAttribute("href")).toBe(
      "https://api.example.com/f",
    );
    expect(screen.getByRole("button", { name: "Change PDF" })).toBeTruthy();
  });
});

function fileSupport(overrides: Partial<CustomFieldFileSupport> = {}): CustomFieldFileSupport {
  return {
    onPick: vi.fn(),
    onClear: vi.fn(),
    isUploading: () => false,
    previewUrlOf: (value) => (typeof value === "string" ? `/preview/${value}` : undefined),
    hrefOf: (value) => (typeof value === "string" ? `/download/${value}` : undefined),
    imageLabels: IMAGE_LABELS,
    fileLabels: FILE_LABELS,
    sendsCredentials: true,
    ...overrides,
  };
}

describe("CustomFieldInputs with IMAGE and FILE fields", () => {
  const FIELDS = [
    { fieldKey: "shop_photo", inputKind: "IMAGE", label: "Shop photo", isRequired: false },
    { fieldKey: "licence", inputKind: "FILE", label: "Licence", isRequired: true },
  ] as const;

  function renderBlock(files: CustomFieldFileSupport, values: Record<string, unknown> = {}) {
    render(
      <CustomFieldInputs
        fields={FIELDS}
        values={values}
        errors={{}}
        onChange={vi.fn()}
        idPrefix="member"
        currencySymbol="৳"
        chooseLabel="Choose"
        notEditableText="Not editable here"
        files={files}
      />,
    );
  }

  it("renders an image input and a file input instead of a not-editable note", () => {
    renderBlock(fileSupport());

    expect(screen.getByRole("button", { name: "Choose image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose PDF" })).toBeTruthy();
    expect(screen.queryByText("Not editable here")).toBeNull();
  });

  it("hands a picked file to the app together with its field key", async () => {
    const files = fileSupport();
    renderBlock(files);
    const file = aPicture();

    await userEvent.upload(
      document.querySelector("input#member-shop_photo") as HTMLInputElement,
      file,
    );

    expect(files.onPick).toHaveBeenCalledWith("shop_photo", file);
  });

  it("previews the saved image and links the saved file", () => {
    renderBlock(fileSupport(), { shop_photo: "image-1", licence: "file-1" });

    expect(screen.getByAltText("Shop photo").getAttribute("src")).toBe("/preview/image-1");
    expect(screen.getByRole("link", { name: "PDF attached" }).getAttribute("href")).toBe(
      "/download/file-1",
    );
  });

  it("cannot remove a required file but can remove an optional image", () => {
    renderBlock(fileSupport(), { shop_photo: "image-1", licence: "file-1" });

    expect(screen.getByRole("button", { name: "Remove image" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove PDF" })).toBeNull();
  });

  it("shows the uploading state of the field being uploaded only", () => {
    renderBlock(fileSupport({ isUploading: (fieldKey) => fieldKey === "licence" }));

    expect(screen.getByRole("button", { name: "Choose image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Uploading" })).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { banglaText, renderInBangla } from "../auth/test-helpers";
import { CustomFieldsEditor } from "./custom-fields-editor";
import { effectiveField } from "./test-fixtures";

const ORGANIZATION_ID = "0198bbbb-0000-7000-8000-000000000002";
const FILE_ID = "0198aaaa-0000-7000-8000-000000000001";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const FIELDS = [
  effectiveField({
    fieldKey: "shop_photo",
    fieldType: CUSTOM_FIELD_TYPE.IMAGE,
    label: { bn: "দোকানের ছবি", en: "Shop photo" },
  }),
];

function Harness({ onValues }: { onValues: (values: Record<string, unknown>) => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return (
    <CustomFieldsEditor
      idPrefix="profile"
      organizationId={ORGANIZATION_ID}
      fields={FIELDS}
      values={values}
      errors={{}}
      currencyCode="BDT"
      onChange={(fieldKey, value) => {
        const next = { ...values, [fieldKey]: value };
        setValues(next);
        onValues(next);
      }}
    />
  );
}

function stubUpload(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("image fields in the extra details", () => {
  it("uploads the chosen picture for this organization and keeps the file id as the value", async () => {
    const fetchMock = stubUpload(201, { data: { fileId: FILE_ID, purpose: "CUSTOM_FIELD_IMAGE" } });
    const onValues = vi.fn();
    renderInBangla(<Harness onValues={onValues} />);
    const picture = new File([new Uint8Array([1, 2])], "shop.png", { type: "image/png" });

    await userEvent.upload(
      document.querySelector("input#profile-shop_photo") as HTMLInputElement,
      picture,
    );

    await waitFor(() => expect(onValues).toHaveBeenCalledWith({ shop_photo: FILE_ID }));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/orgs/${ORGANIZATION_ID}/files`);
    const body = init.body as FormData;
    expect(body.get("purpose")).toBe("CUSTOM_FIELD_IMAGE");
    expect((body.get("file") as File).name).toBe("shop.png");
  });

  it("shows the API's refusal under the field and keeps the value empty", async () => {
    stubUpload(415, {
      error: { code: "UNSUPPORTED_MEDIA_TYPE", messageKey: "errors.file_type_not_allowed" },
    });
    const onValues = vi.fn();
    renderInBangla(<Harness onValues={onValues} />);

    await userEvent.upload(
      document.querySelector("input#profile-shop_photo") as HTMLInputElement,
      new File(["<html/>"], "shop.png", { type: "image/png" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      banglaText("errors.file_type_not_allowed"),
    );
    expect(onValues).not.toHaveBeenCalled();
  });
});

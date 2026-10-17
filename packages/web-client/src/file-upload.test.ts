import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api-client.js";
import { organizationFileUrl, publicFileUrl, uploadFile } from "./file-upload.js";

const CONFIG = {
  baseUrl: "https://api.example.com",
  apiPrefix: "/api/v1",
  refreshPath: "/auth/refresh",
  authPathPrefix: "/auth/",
  onSessionLost: () => undefined,
};
const FILE_ID = "0198aaaa-0000-7000-8000-000000000001";
const ORGANIZATION_ID = "0198bbbb-0000-7000-8000-000000000002";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("uploadFile", () => {
  it("posts the purpose and then the file as multipart, without a JSON content type", async () => {
    const fetchMock = stubFetch(201, { data: { fileId: FILE_ID, purpose: "LOGO" } });
    const { apiFetch } = createApiClient(CONFIG);
    const file = new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" });

    const uploaded = await uploadFile(apiFetch, {
      organizationId: ORGANIZATION_ID,
      purpose: "LOGO",
      file,
    });

    expect(uploaded.fileId).toBe(FILE_ID);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/api/v1/orgs/${ORGANIZATION_ID}/files`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    const body = init.body as FormData;
    expect([...body.keys()]).toEqual(["purpose", "file"]);
    expect(body.get("purpose")).toBe("LOGO");
    expect((body.get("file") as File).name).toBe("logo.png");
  });

  it("rejects with the API's error when the upload is refused", async () => {
    stubFetch(415, {
      error: { code: "UNSUPPORTED_MEDIA_TYPE", messageKey: "errors.file_type_not_allowed" },
    });
    const { apiFetch } = createApiClient(CONFIG);

    await expect(
      uploadFile(apiFetch, {
        organizationId: ORGANIZATION_ID,
        purpose: "LOGO",
        file: new File(["x"], "a.svg"),
      }),
    ).rejects.toMatchObject({ status: 415, messageKey: "errors.file_type_not_allowed" });
  });
});

describe("file addresses", () => {
  it("builds the public address of a file", () => {
    expect(publicFileUrl("https://api.example.com", FILE_ID, "medium")).toBe(
      `https://api.example.com/api/v1/public/files/${FILE_ID}/medium`,
    );
  });

  it("builds the address of a file of the organization, with the size when given", () => {
    const base = { baseUrl: "https://api.example.com", apiPrefix: "/api/v1" };

    expect(
      organizationFileUrl(base, {
        organizationId: ORGANIZATION_ID,
        fileId: FILE_ID,
        variant: "thumb",
      }),
    ).toBe(
      `https://api.example.com/api/v1/orgs/${ORGANIZATION_ID}/files/${FILE_ID}/content?variant=thumb`,
    );
    expect(organizationFileUrl(base, { organizationId: ORGANIZATION_ID, fileId: FILE_ID })).toBe(
      `https://api.example.com/api/v1/orgs/${ORGANIZATION_ID}/files/${FILE_ID}/content`,
    );
  });
});

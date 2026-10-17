import type { FileVariant } from "@banijjik/contracts/file";
import { asId } from "@banijjik/ids";
import { filePurposeSchema } from "@banijjik/validation";
import type { Request, RequestHandler, Response } from "express";
import { readTenantIdentity } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { DeleteFileUseCase } from "../application/use-cases/delete-file.use-case.js";
import type { GetFileUseCase } from "../application/use-cases/get-file.use-case.js";
import type { ReadFileContentUseCase } from "../application/use-cases/read-file-content.use-case.js";
import type { ReadPublicFileUseCase } from "../application/use-cases/read-public-file.use-case.js";
import type { UploadFileUseCase } from "../application/use-cases/upload-file.use-case.js";
import { invalidUpload } from "../domain/errors.js";
import type { FileAssetId } from "../domain/file-asset.entity.js";
import { FILE_CACHE_CONTROL, sendFileContent } from "./file-response-headers.js";
import { readUpload, type ReadUploadOptions } from "./read-upload.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

export interface FileControllerDependencies {
  readonly uploadFile: UploadFileUseCase;
  readonly getFile: GetFileUseCase;
  readonly readContent: ReadFileContentUseCase;
  readonly readPublic: ReadPublicFileUseCase;
  readonly deleteFile: DeleteFileUseCase;
  /** Tests shorten the upload timeout. */
  readonly uploadOptions?: ReadUploadOptions;
}

function readFileId(request: Request): FileAssetId {
  return asId<FileAssetId>(String(request.params["fileId"]));
}

function readVariant(response: Response): FileVariant | undefined {
  // Safe: validate({ query: fileContentQuerySchema }) produced this value on this route.
  return response.locals["validated"].query.variant as FileVariant | undefined;
}

/**
 * After an upload is refused part-way the client may still be sending. The answer goes out first,
 * with `Connection: close`, and then the request is destroyed so no more bytes are read.
 */
function closeAfterResponse(request: Request, response: Response): void {
  response.setHeader("Connection", "close");
  response.once("finish", () => request.destroy());
}

export class FileController {
  constructor(private readonly dependencies: FileControllerDependencies) {}

  readonly upload: RequestHandler = async (request, response) => {
    const uploaded = await readUpload(request, this.dependencies.uploadOptions).catch(
      (error: unknown) => {
        closeAfterResponse(request, response);
        throw error;
      },
    );
    const purpose = filePurposeSchema.safeParse(uploaded.purpose);
    if (!purpose.success) throw invalidUpload("purpose");
    const created = await this.dependencies.uploadFile.execute({
      ...readTenantIdentity(),
      purpose: purpose.data,
      originalName: uploaded.originalName,
      bytes: uploaded.bytes,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly get: RequestHandler = async (request, response) => {
    sendData(response, await this.dependencies.getFile.execute({ fileId: readFileId(request) }));
  };

  readonly content: RequestHandler = async (request, response) => {
    const content = await this.dependencies.readContent.execute({
      fileId: readFileId(request),
      variant: readVariant(response),
    });
    await sendFileContent({
      response,
      content,
      cacheControl: FILE_CACHE_CONTROL.PRIVATE,
      isEmbeddable: false,
    });
  };

  readonly remove: RequestHandler = async (request, response) => {
    await this.dependencies.deleteFile.execute({
      ...readTenantIdentity(),
      fileId: readFileId(request),
    });
    response.status(HTTP_NO_CONTENT).end();
  };

  readonly publicContent: RequestHandler = async (request, response) => {
    // Safe: validate({ params: publicFileParamsSchema }) checked both parts on this route.
    const variant = String(request.params["variant"]) as FileVariant;
    const content = await this.dependencies.readPublic.execute({
      fileId: readFileId(request),
      variant,
    });
    await sendFileContent({
      response,
      content,
      cacheControl: FILE_CACHE_CONTROL.PUBLIC,
      isEmbeddable: true,
    });
  };
}

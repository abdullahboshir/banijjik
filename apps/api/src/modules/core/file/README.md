# file

Uploaded files and images (ADR-109). One owner for logos, offering images, FILE and IMAGE custom field values and later attachments.

- **Upload:** `POST /orgs/{organizationId}/files`, multipart with a `purpose` field and one `file`. The type is read from the content, never from the name or declared type. Images are re-encoded to WebP `thumb`, `medium` and `large` without metadata; a PDF is stored as received.
- **Visibility** comes from the purpose: LOGO and OFFERING_IMAGE are PUBLIC and served without a session at `/api/v1/public/files/{fileId}/{variant}`; the rest are PRIVATE and need `file.asset.read`.
- **Storage:** the `FileStorage` port. Local disk for development and tests, S3-compatible object storage for production (config refuses local disk there).
- **Quota:** 1 GiB per organization for now (`FileUsage` counter, reserved in the insert transaction).
- **Delete** marks the file DELETED and removes its objects. Nothing tracks which fields still name the file: a field that does now points at nothing, so the caller must clear references first until reference tracking exists.
- **Other modules** ask `buildFileReferenceReader()` (through `index.ts`) whether a file id is usable for a purpose, and adapt it to their own port.

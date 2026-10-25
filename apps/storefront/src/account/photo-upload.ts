import { DIRECTORY_PHOTO_POLICY, type DirectoryPhotoPolicy } from "@banijjik/contracts/directory";

/**
 * The photo field is shown only when the business's photo policy allows photos (M.6 decision 15). With the
 * default policy NONE the form has no upload field at all; the API refuses photos in that case anyway.
 */
export function showsPhotoUpload(policy: DirectoryPhotoPolicy | undefined): boolean {
  return policy !== undefined && policy !== DIRECTORY_PHOTO_POLICY.NONE;
}

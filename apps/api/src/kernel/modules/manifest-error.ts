/** A module manifest or the set of manifests breaks a rule. Thrown at startup so a bad release never serves traffic. */
export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

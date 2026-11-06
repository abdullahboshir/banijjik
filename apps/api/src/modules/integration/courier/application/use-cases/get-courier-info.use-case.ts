import type { CourierInfo, CourierInfoSource } from "../ports/courier-info.source.js";

/** The smallest use case: it asks its port and returns the answer. New use cases copy this shape. */
export class GetCourierInfoUseCase {
  constructor(private readonly source: CourierInfoSource) {}

  execute(): CourierInfo {
    return this.source.read();
  }
}

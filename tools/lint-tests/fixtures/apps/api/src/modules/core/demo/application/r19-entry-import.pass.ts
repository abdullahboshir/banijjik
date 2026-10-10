import { otherPublicValue } from "../../other/index.js";
import { platformDemoValue } from "../../../platform/demo/index.js";
import { demoDomainValue } from "../domain/entity.js";

export const combinedValue = otherPublicValue + platformDemoValue + demoDomainValue;

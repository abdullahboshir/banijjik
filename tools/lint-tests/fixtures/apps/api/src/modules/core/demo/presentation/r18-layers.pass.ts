import { demoApplicationValue } from "../application/use-case.js";
import { demoDomainValue } from "../domain/entity.js";

export const reusedValue = demoApplicationValue + demoDomainValue;

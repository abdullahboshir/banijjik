import { defineEnum } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { demoDomainValue } from "./entity.js";

export const orderStatus = defineEnum(["OPEN", "CLOSED"]);
export const createdValue = { demoDomainValue, id: newId() };

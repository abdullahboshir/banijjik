import { configValue } from "../../config/settings.js";
import { kernelHelperValue } from "./helper.js";

export const combinedValue = configValue + kernelHelperValue;

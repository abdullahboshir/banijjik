import { configValue } from "../config/settings.js";
import { kernelHelperValue } from "../kernel/http/helper.js";
import { otherPublicValue } from "../modules/core/other/index.js";

export const combinedValue = otherPublicValue + kernelHelperValue + configValue;

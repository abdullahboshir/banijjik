import { appConfig } from "../config/app.config";
export async function bootstrapConfig() {
    if (!appConfig.db_url) {
        throw new Error("DB_URL missing");
    }
    if (!appConfig.port) {
        console.warn("⚠️ PORT not set, using default");
    }
    console.log("✅ Config validated");
}
//# sourceMappingURL=config.bootstrap.js.map
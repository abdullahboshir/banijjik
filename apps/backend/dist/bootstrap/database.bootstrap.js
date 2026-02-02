import mongoose from "mongoose";
import { appConfig } from "../config/app.config";
export async function bootstrapDatabase() {
    if (!appConfig.db_url) {
        throw new Error("Database URL is not defined");
    }
    await mongoose.connect(appConfig.db_url);
    console.log("✅ MongoDB Connected");
    registerShutdown();
}
function registerShutdown() {
    const shutdown = async () => {
        await mongoose.connection.close();
        console.log("🛑 MongoDB disconnected");
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
//# sourceMappingURL=database.bootstrap.js.map
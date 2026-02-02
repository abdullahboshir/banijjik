import "dotenv/config";
import { appConfig } from "./config/app.config.js";
console.log("=====================================");
console.log("✅ Config loaded successfully!");
console.log("Port:", appConfig.port);
console.log("DB_URL length:", appConfig.db_url?.length || 0);
console.log("=====================================");
//# sourceMappingURL=test-config.js.map
import "dotenv/config";
import app from "./app.js";
import { bootstrapApp } from "./bootstrap/bootstrap.js";
import { appConfig } from "./config/app.config.js";
async function main() {
    if (!app)
        return;
    await bootstrapApp(app);
    const port = appConfig.port || 5001;
    app
        .listen(port, () => {
        console.log("=================================================");
        console.log(`🚀 Banijjik Backend is running!`);
        console.log(`🌐 URL: http://localhost:${port}`);
        console.log(`📍 API: http://localhost:${port}/api/v1`);
        console.log(`📅 Time: ${new Date().toLocaleString()}`);
        console.log("=================================================");
    })
        .on("error", (error) => {
        if (error.code === "EADDRINUSE") {
            console.error(`🔥 Error: Port ${port} is already in use.`);
        }
        else {
            console.error(`🔥 Server error:`, error.message);
        }
        process.exit(1);
    });
}
main();
//# sourceMappingURL=server.js.map
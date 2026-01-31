import express from "express";
import { ServerBootstrap } from "./bootstrap";
import { v1Router as platformV1Router } from "./routes/platform/v1";
import { v1Router as organizationV1Router } from "./routes/organization/v1";

const app = express();

// Initialize global middleware via ServerBootstrap (Clean DDD)
ServerBootstrap.getInstance().initialize(app);

// Health check route
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Banijjik API is running",
    timestamp: new Date().toISOString(),
  });
});

// Mount domain routes
app.use("/api/v1/platform", platformV1Router);
app.use("/api/v1/organization", organizationV1Router);

// Setup error handling AFTER all routes
ServerBootstrap.getInstance().setupErrorHandling(app);

export default app;

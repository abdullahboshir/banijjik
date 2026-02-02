import express from "express";
import { ServerBootstrap } from "./bootstrap/server.bootstrap";
import { apiRouter } from "./routes";

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
// Mount Main Router
app.use("/api", apiRouter);

// Setup error handling AFTER all routes
ServerBootstrap.getInstance().setupErrorHandling(app);

export default app;

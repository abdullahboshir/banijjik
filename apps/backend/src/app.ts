import express from "express";
import { ServerBootstrap } from "./bootstrap";

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

// TODO: Mount domain routes here
// e.g., app.use('/api/v1/platform', platformRouter);

// Setup error handling AFTER all routes
ServerBootstrap.getInstance().setupErrorHandling(app);

export default app;

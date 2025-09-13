import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { spawn, type ChildProcess } from "child_process";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

// Global variables for Flask process management
let flaskProcess: ChildProcess | null = null;

// Start Flask backend process
function startFlaskBackend() {
  log("Starting Flask backend on localhost:5050...");
  
  flaskProcess = spawn("python3", ["flask_backend/run.py"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env }
  });

  flaskProcess.stdout?.on("data", (data) => {
    const output = data.toString().trim();
    if (output) log(`[flask] ${output}`);
  });

  flaskProcess.stderr?.on("data", (data) => {
    const error = data.toString().trim();
    if (error) log(`[flask-error] ${error}`);
  });

  flaskProcess.on("error", (error) => {
    log(`Flask process error: ${error.message}`);
  });

  flaskProcess.on("exit", (code) => {
    log(`Flask process exited with code ${code}`);
    flaskProcess = null;
  });

  // Give Flask time to start
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      log("Flask backend should be ready");
      resolve();
    }, 3000);
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  if (flaskProcess) {
    log("Terminating Flask process...");
    flaskProcess.kill("SIGTERM");
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  if (flaskProcess) {
    log("Terminating Flask process...");
    flaskProcess.kill("SIGTERM");
  }
  process.exit(0);
});

// Add Flask proxy middleware BEFORE other middleware
// Use context-based middleware to preserve /api prefix
app.use('/api', createProxyMiddleware({
  target: 'http://127.0.0.1:5050',
  changeOrigin: true,
  logLevel: 'warn',
  pathRewrite: (path) => '/api' + path  // Re-add /api prefix
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); // Enable cookie parsing for secure sessions

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Start Flask backend first
  await startFlaskBackend();
  
  // Skip Express routes since we're proxying to Flask
  // const server = await registerRoutes(app);
  
  // Create HTTP server directly since we're proxying to Flask
  const { createServer } = await import("http");
  const server = createServer(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

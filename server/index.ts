import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

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
  // Register Express routes
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    // If headers already sent, delegate to default Express error handler
    if (res.headersSent) {
      return next(err);
    }
    
    console.error('Unhandled error:', err);
    
    // Handle specific Multer errors with proper JSON responses
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: "File too large. Maximum file size is 50MB." });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: "Invalid file field. Please use 'document' field name." });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: "Too many files. Maximum 1 file allowed." });
    }
    
    // Handle other error types
    const status = err.status || err.statusCode || 500;
    
    // Use generic message for 500+ errors to avoid information disclosure
    const message = status >= 500 ? "Internal Server Error" : (err.message || "An error occurred");
    
    return res.status(status).json({ error: message });
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
    
    // Set up quarterly FRA data sync scheduler (singleton - runs only once at startup)
    setupQuarterlyFRASync();
  });
})();

/**
 * Set up quarterly FRA data sync scheduler (called once at server startup)
 */
let quarterlySchedulerInitialized = false;
function setupQuarterlyFRASync(): void {
  if (quarterlySchedulerInitialized) {
    log('Quarterly FRA sync scheduler already initialized, skipping');
    return;
  }
  
  quarterlySchedulerInitialized = true;
  
  // In production, this would be a proper cron job or task scheduler
  // For development, we set up a timer-based approach
  const THREE_MONTHS_MS = 7 * 24 * 60 * 60 * 1000; // 1 week for testing (normally would be 3 months)
  
  const scheduleNextSync = () => {
    const nextSync = new Date();
    nextSync.setMonth(nextSync.getMonth() + 3);
    
    log(`FRA quarterly data sync scheduled for: ${nextSync.toDateString()}`);
    
    // Schedule the next sync
    setTimeout(async () => {
      try {
        log('Running scheduled FRA data sync...');
        const { RealFRAImportService } = await import('./real-fra-import');
        const storage = await import('./storage');
        const realImportService = new RealFRAImportService(storage.storage);
        
        const csvFilePath = await realImportService.downloadRealFRAData();
        const imported = await realImportService.importRealFRAStatistics(csvFilePath);
        
        log(`Scheduled sync completed: imported ${imported} FRA statistics`);
        
        // Schedule the next sync
        scheduleNextSync();
      } catch (error) {
        console.error('Scheduled FRA sync failed:', error);
        // Retry in 24 hours on failure
        setTimeout(scheduleNextSync, 24 * 60 * 60 * 1000);
      }
    }, THREE_MONTHS_MS);
  };
  
  scheduleNextSync();
  log('Quarterly FRA data sync scheduler initialized successfully');
}

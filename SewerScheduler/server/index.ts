import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations, pool } from "./db";
import { runMigrations as runStripeMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy for production (needed for secure cookies behind reverse proxy)
if (isProduction) {
  app.set('trust proxy', 1);
}

// CRITICAL: Register Stripe webhook route BEFORE express.json()
// This webhook needs raw Buffer, not parsed JSON
app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Configure session store
const PgSession = connectPgSimple(session);
const sessionStore = pool ? new PgSession({
  pool: pool,
  tableName: 'session',
  createTableIfMissing: true,
}) : undefined;

// Session configuration
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'crew-scheduling-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
  proxy: isProduction,
}));

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

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
  const server = await registerRoutes(app);

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

  // Run database migrations - non-blocking to allow health checks
  const dbSuccess = await runMigrations();
  if (dbSuccess) {
    log("Database ready");
    
    // Initialize Stripe after database is ready
    try {
      log("Initializing Stripe...");
      const isProduction = process.env.NODE_ENV === 'production';
      const databaseUrl = isProduction && process.env.PRODUCTION_DATABASE_URL 
        ? process.env.PRODUCTION_DATABASE_URL 
        : process.env.DATABASE_URL!;
      
      await runStripeMigrations({ 
        databaseUrl
      });
      log("Stripe schema ready");
      
      const stripeSync = await getStripeSync();
      
      // Set up managed webhook
      const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      if (webhookBaseUrl && webhookBaseUrl !== 'https://undefined') {
        const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`,
          {
            enabled_events: ['*'],
            description: 'Managed webhook for Stripe sync',
          }
        );
        log(`Stripe webhook configured: ${webhook.url} (UUID: ${uuid})`);
      }
      
      // Sync Stripe data in background
      stripeSync.syncBackfill()
        .then(() => log("Stripe data synced"))
        .catch((err: any) => console.error("Error syncing Stripe data:", err));
      
      log("Stripe initialized");
    } catch (stripeError: any) {
      console.error("Failed to initialize Stripe:", stripeError.message);
      log("Stripe not available - payment features disabled");
    }
  } else {
    log("Database not available - running in degraded mode");
    log("API routes requiring database will return 503");
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

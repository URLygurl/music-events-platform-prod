import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import * as net from "net";
import { maintenancePage } from "./maintenance";

// Farm OIDC is in NZ (~270-340ms from Railway); Node's 250ms per-address connect limit made every attempt ETIMEDOUT.
if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === "function") net.setDefaultAutoSelectFamilyAttemptTimeout(2000);
const app = express();
const httpServer = createServer(app);
app.set("trust proxy", 1);
declare module "http" {
  interface IncomingMessage { rawBody: unknown; }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

if (process.env.MAINTENANCE_MODE === "true") {
  app.disable("x-powered-by");
  app.use((_req, res) => res.status(200).set("Cache-Control", "no-store").type("html").send(maintenancePage));
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => log(`maintenance page serving on port ${port}`));
} else {
  const { registerRoutes } = await import("./routes");
  const { serveStatic } = await import("./static");
  const { initializeBetterAuth, mountBetterAuth } = await import("./better-auth");

  // Must precede body parsers; separate path preserves the existing login API.
  mountBetterAuth(app);

  app.use(express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; },
  }));
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    res.on("finish", () => {
      if (path.startsWith("/api")) {
        // Never log response bodies, passwords, keys, codes, cookies or link queries.
        log(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
      }
    });
    next();
  });

  (async () => {
    const { seedDatabase } = await import("./seed");
    await seedDatabase().catch((err) => console.error("Seed error:", err));
    await initializeBetterAuth();
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      if (res.headersSent) return next(err);
      // Log no request payloads or auth/provider error details.
      console.error("Request failed with status", status);
      return res.status(status).json({ message: status >= 500 ? "Internal Server Error" : "Request failed" });
    });

    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => log(`serving on port ${port}`));
  })();
}

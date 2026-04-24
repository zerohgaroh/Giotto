import cookieParser from "cookie-parser";
import express from "express";
import path from "path";
import { maybeRunStaffBackendMaintenance } from "../lib/staff-backend/maintenance";
import { verifyPushDeliveryStartup } from "../lib/staff-backend/notifications";
import { createApiRouter } from "./routes/api";
import { createWebRouter } from "./routes/web";
import { serializeForScript, wantsHtml } from "./http";

export async function createApp() {
  if (process.env.NODE_ENV !== "test") {
    console.log("[startup] Verifying FCM push configuration");
    const pushStartup = await verifyPushDeliveryStartup();
    if (pushStartup.status === "ready") {
      console.log("[startup] FCM push configuration is ready", {
        projectId: pushStartup.projectId,
        clientEmail: pushStartup.clientEmail,
        accessTokenExpiresInSec: pushStartup.accessTokenExpiresInSec,
      });
    } else if (pushStartup.status === "disabled") {
      console.warn("[startup] FCM push configuration is disabled", {
        reason: pushStartup.reason,
        message: pushStartup.message,
      });
    } else {
      console.warn("[startup] FCM push configuration check failed", {
        reason: pushStartup.reason,
        message: pushStartup.message,
        error: pushStartup.error,
        projectId: pushStartup.projectId,
        clientEmail: pushStartup.clientEmail,
      });
    }
  }

  const app = express();

  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", path.join(process.cwd(), "views"));
  app.locals.serialize = serializeForScript;

  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: "6mb" }));

  app.use("/assets", express.static(path.join(process.cwd(), "public", "assets")));
  app.use(express.static(path.join(process.cwd(), "public")));

  app.use((req, res, next) => {
    res.locals.assetCssPath = "/assets/app.css";
    res.locals.assetJsPath = "/assets/guest.js";
    res.locals.currentPath = req.path;
    next();
  });

  app.use((req, _res, next) => {
    if (req.path.startsWith("/assets") || req.path.startsWith("/brand")) {
      next();
      return;
    }

    maybeRunStaffBackendMaintenance()
      .catch((error) => {
        console.error("[maintenance] failed");
        console.error(error);
      })
      .finally(() => next());
  });

  app.use("/api", createApiRouter());
  app.use("/", createWebRouter());

  app.use((req, res) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (wantsHtml(req)) {
      res.redirect("/guest");
      return;
    }

    res.status(404).send("Not found");
  });

  return app;
}

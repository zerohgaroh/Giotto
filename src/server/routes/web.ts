import { Router } from "express";
import { getGuestErrorText, createGuestAccessHandler, requireGuestTableAccess, buildTableLocals } from "../guest";
import { asyncHandler, isHtmxRequest } from "../http";
import { loadRestaurantViewModel, loadTableViewModel } from "../views";

export function createWebRouter() {
  const web = Router();

  web.get(
    "/",
    asyncHandler(async (_req, res) => {
      const { restaurant, profile } = await loadRestaurantViewModel();

      res.render("pages/public-menu", {
        pageTitle: `${profile.name} · Меню`,
        restaurant,
        publicMenuModel: {
          profile,
          categories: restaurant.categories,
          dishes: restaurant.dishes,
        },
      });
    }),
  );

  web.all(/^\/(?:login|manager(?:\/.*)?|waiter(?:\/.*)?|restaurants(?:\/.*)?)$/, (_req, res) => {
    res.redirect("/guest");
  });

  web.get(
    "/guest",
    asyncHandler(async (req, res) => {
      const { profile } = await loadRestaurantViewModel();
      res.render("pages/guest", {
        pageTitle: "Giotto",
        profile,
        errorText: getGuestErrorText(req.query.error),
      });
    }),
  );

  web.get("/t/:tableId", (_req, res) => {
    res.redirect("/guest?error=missing-access-key");
  });

  web.get("/t/:tableId/:accessKey", createGuestAccessHandler());

  web.use("/table/:tableId", requireGuestTableAccess);

  web.get(
    "/table/:tableId",
    asyncHandler(async (req, res) => {
      const tableId = req.guestTableId!;
      const locals = buildTableLocals(tableId);
      const { profile, wifiQrUrl } = await loadTableViewModel(tableId);

      res.render("pages/table-hub", {
        pageTitle: `${profile.name} · Стол ${locals.tableLabel}`,
        profile,
        wifiQrUrl,
        ...locals,
      });
    }),
  );

  web.get(
    "/table/:tableId/menu",
    asyncHandler(async (req, res) => {
      const tableId = req.guestTableId!;
      const locals = buildTableLocals(tableId);
      const { restaurant } = await loadTableViewModel(tableId);
      const requestedCategory = typeof req.query.cat === "string" ? req.query.cat : "all";
      const initialCategory =
        requestedCategory === "all" || restaurant.categories.some((category) => category.id === requestedCategory)
          ? requestedCategory
          : "all";

      res.render("pages/menu", {
        pageTitle: `${restaurant.profile.name} · Меню`,
        restaurant,
        ...locals,
        menuModel: {
          tableId,
          basePath: locals.tablePath,
          menuPath: locals.menuPath,
          waiterPath: locals.waiterPath,
          cartPath: locals.cartPath,
          tableLabel: locals.tableLabel,
          profile: restaurant.profile,
          categories: restaurant.categories,
          dishes: restaurant.dishes,
          initialCategory,
        },
      });
    }),
  );

  web.get(
    "/table/:tableId/cart",
    asyncHandler(async (req, res) => {
      const tableId = req.guestTableId!;
      const locals = buildTableLocals(tableId);
      const { restaurant } = await loadTableViewModel(tableId);

      res.render("pages/cart", {
        pageTitle: `${restaurant.profile.name} · Корзина`,
        restaurant,
        ...locals,
        cartModel: {
          tableId,
          tablePath: locals.tablePath,
          menuPath: locals.menuPath,
          cartPath: locals.cartPath,
          waiterPath: locals.waiterPath,
          complaintPath: locals.complaintPath,
          profile: restaurant.profile,
          dishes: restaurant.dishes,
        },
      });
    }),
  );

  web.get(
    "/table/:tableId/waiter",
    asyncHandler(async (req, res) => {
      const tableId = req.guestTableId!;
      const locals = buildTableLocals(tableId);
      const { restaurant } = await loadTableViewModel(tableId);
      const requestType = req.query.intent === "bill" ? "bill" : "waiter";

      res.render("pages/waiter", {
        pageTitle: requestType === "bill" ? "Счёт" : "Вызов официанта",
        restaurant,
        ...locals,
        waiterModel: {
          tableId,
          tablePath: locals.tablePath,
          requestType,
          actionLabel: requestType === "bill" ? "Принести счёт" : "Позвать официанта",
          tableLabel: locals.tableLabel,
          cooldownUrl: `/api/table/${encodeURIComponent(tableId)}/request?type=${requestType}`,
          requestUrl: `/api/table/${encodeURIComponent(tableId)}/request`,
        },
      });
    }),
  );

  web.get(
    "/table/:tableId/complaint",
    asyncHandler(async (req, res) => {
      const tableId = req.guestTableId!;
      const locals = buildTableLocals(tableId);
      const { profile } = await loadTableViewModel(tableId);

      res.render("pages/complaint", {
        pageTitle: `${profile.name} · Жалоба`,
        profile,
        ...locals,
        complaintSent: false,
        complaintError: "",
        complaintText: "",
      });
    }),
  );

  web.post(
    "/table/:tableId/complaint",
    asyncHandler(async (req, res) => {
      const tableId = req.guestTableId!;
      const locals = buildTableLocals(tableId);
      const { profile } = await loadTableViewModel(tableId);
      const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

      const localsBase = {
        profile,
        ...locals,
      };

      if (!text) {
        if (isHtmxRequest(req)) {
          res.render("partials/complaint-form", {
            ...localsBase,
            complaintError: "Опишите ситуацию, чтобы мы могли помочь.",
            complaintText: "",
          });
          return;
        }

        res.status(400).render("pages/complaint", {
          pageTitle: `${profile.name} · Жалоба`,
          ...localsBase,
          complaintSent: false,
          complaintError: "Опишите ситуацию, чтобы мы могли помочь.",
          complaintText: "",
        });
        return;
      }

      if (isHtmxRequest(req)) {
        res.render("partials/complaint-success", localsBase);
        return;
      }

      res.render("pages/complaint", {
        pageTitle: `${profile.name} · Жалоба`,
        ...localsBase,
        complaintSent: true,
        complaintError: "",
        complaintText: text,
      });
    }),
  );

  return web;
}

"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebRouter = createWebRouter;
var express_1 = require("express");
var guest_1 = require("../guest");
var http_1 = require("../http");
var views_1 = require("../views");
function createWebRouter() {
    var _this = this;
    var web = (0, express_1.Router)();
    web.get("/", function (_req, res) {
        res.redirect("/guest");
    });
    web.all(/^\/(?:login|manager(?:\/.*)?|waiter(?:\/.*)?|restaurants(?:\/.*)?)$/, function (_req, res) {
        res.redirect("/guest");
    });
    web.get("/guest", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var profile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, views_1.loadRestaurantViewModel)()];
                case 1:
                    profile = (_a.sent()).profile;
                    res.render("pages/guest", {
                        pageTitle: "Giotto",
                        profile: profile,
                        errorText: (0, guest_1.getGuestErrorText)(req.query.error),
                    });
                    return [2 /*return*/];
            }
        });
    }); }));
    web.get("/t/:tableId", function (_req, res) {
        res.redirect("/guest?error=missing-access-key");
    });
    web.get("/t/:tableId/:accessKey", (0, guest_1.createGuestAccessHandler)());
    web.use("/table/:tableId", guest_1.requireGuestTableAccess);
    web.get("/table/:tableId", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var tableId, locals, _a, profile, wifiQrUrl;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    tableId = req.guestTableId;
                    locals = (0, guest_1.buildTableLocals)(tableId);
                    return [4 /*yield*/, (0, views_1.loadTableViewModel)(tableId)];
                case 1:
                    _a = _b.sent(), profile = _a.profile, wifiQrUrl = _a.wifiQrUrl;
                    res.render("pages/table-hub", __assign({ pageTitle: "".concat(profile.name, " \u00B7 \u0421\u0442\u043E\u043B ").concat(locals.tableLabel), profile: profile, wifiQrUrl: wifiQrUrl }, locals));
                    return [2 /*return*/];
            }
        });
    }); }));
    web.get("/table/:tableId/menu", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var tableId, locals, restaurant, requestedCategory, initialCategory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tableId = req.guestTableId;
                    locals = (0, guest_1.buildTableLocals)(tableId);
                    return [4 /*yield*/, (0, views_1.loadTableViewModel)(tableId)];
                case 1:
                    restaurant = (_a.sent()).restaurant;
                    requestedCategory = typeof req.query.cat === "string" ? req.query.cat : "all";
                    initialCategory = requestedCategory === "all" || restaurant.categories.some(function (category) { return category.id === requestedCategory; })
                        ? requestedCategory
                        : "all";
                    res.render("pages/menu", __assign(__assign({ pageTitle: "".concat(restaurant.profile.name, " \u00B7 \u041C\u0435\u043D\u044E"), restaurant: restaurant }, locals), { menuModel: {
                            tableId: tableId,
                            basePath: locals.tablePath,
                            menuPath: locals.menuPath,
                            waiterPath: locals.waiterPath,
                            cartPath: locals.cartPath,
                            tableLabel: locals.tableLabel,
                            profile: restaurant.profile,
                            categories: restaurant.categories,
                            dishes: restaurant.dishes,
                            initialCategory: initialCategory,
                        } }));
                    return [2 /*return*/];
            }
        });
    }); }));
    web.get("/table/:tableId/cart", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var tableId, locals, restaurant;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tableId = req.guestTableId;
                    locals = (0, guest_1.buildTableLocals)(tableId);
                    return [4 /*yield*/, (0, views_1.loadTableViewModel)(tableId)];
                case 1:
                    restaurant = (_a.sent()).restaurant;
                    res.render("pages/cart", __assign(__assign({ pageTitle: "".concat(restaurant.profile.name, " \u00B7 \u041A\u043E\u0440\u0437\u0438\u043D\u0430"), restaurant: restaurant }, locals), { cartModel: {
                            tableId: tableId,
                            tablePath: locals.tablePath,
                            menuPath: locals.menuPath,
                            cartPath: locals.cartPath,
                            waiterPath: locals.waiterPath,
                            complaintPath: locals.complaintPath,
                            profile: restaurant.profile,
                            dishes: restaurant.dishes,
                        } }));
                    return [2 /*return*/];
            }
        });
    }); }));
    web.get("/table/:tableId/waiter", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var tableId, locals, restaurant, requestType;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tableId = req.guestTableId;
                    locals = (0, guest_1.buildTableLocals)(tableId);
                    return [4 /*yield*/, (0, views_1.loadTableViewModel)(tableId)];
                case 1:
                    restaurant = (_a.sent()).restaurant;
                    requestType = req.query.intent === "bill" ? "bill" : "waiter";
                    res.render("pages/waiter", __assign(__assign({ pageTitle: requestType === "bill" ? "Счёт" : "Вызов официанта", restaurant: restaurant }, locals), { waiterModel: {
                            tableId: tableId,
                            tablePath: locals.tablePath,
                            requestType: requestType,
                            actionLabel: requestType === "bill" ? "Принести счёт" : "Позвать официанта",
                            tableLabel: locals.tableLabel,
                            cooldownUrl: "/api/table/".concat(encodeURIComponent(tableId), "/request?type=").concat(requestType),
                            requestUrl: "/api/table/".concat(encodeURIComponent(tableId), "/request"),
                        } }));
                    return [2 /*return*/];
            }
        });
    }); }));
    web.get("/table/:tableId/complaint", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var tableId, locals, profile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tableId = req.guestTableId;
                    locals = (0, guest_1.buildTableLocals)(tableId);
                    return [4 /*yield*/, (0, views_1.loadTableViewModel)(tableId)];
                case 1:
                    profile = (_a.sent()).profile;
                    res.render("pages/complaint", __assign(__assign({ pageTitle: "".concat(profile.name, " \u00B7 \u0416\u0430\u043B\u043E\u0431\u0430"), profile: profile }, locals), { complaintSent: false, complaintError: "", complaintText: "" }));
                    return [2 /*return*/];
            }
        });
    }); }));
    web.post("/table/:tableId/complaint", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var tableId, locals, profile, text, localsBase;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tableId = req.guestTableId;
                    locals = (0, guest_1.buildTableLocals)(tableId);
                    return [4 /*yield*/, (0, views_1.loadTableViewModel)(tableId)];
                case 1:
                    profile = (_a.sent()).profile;
                    text = typeof req.body.text === "string" ? req.body.text.trim() : "";
                    localsBase = __assign({ profile: profile }, locals);
                    if (!text) {
                        if ((0, http_1.isHtmxRequest)(req)) {
                            res.render("partials/complaint-form", __assign(__assign({}, localsBase), { complaintError: "Опишите ситуацию, чтобы мы могли помочь.", complaintText: "" }));
                            return [2 /*return*/];
                        }
                        res.status(400).render("pages/complaint", __assign(__assign({ pageTitle: "".concat(profile.name, " \u00B7 \u0416\u0430\u043B\u043E\u0431\u0430") }, localsBase), { complaintSent: false, complaintError: "Опишите ситуацию, чтобы мы могли помочь.", complaintText: "" }));
                        return [2 /*return*/];
                    }
                    if ((0, http_1.isHtmxRequest)(req)) {
                        res.render("partials/complaint-success", localsBase);
                        return [2 /*return*/];
                    }
                    res.render("pages/complaint", __assign(__assign({ pageTitle: "".concat(profile.name, " \u00B7 \u0416\u0430\u043B\u043E\u0431\u0430") }, localsBase), { complaintSent: true, complaintError: "", complaintText: text }));
                    return [2 /*return*/];
            }
        });
    }); }));
    return web;
}

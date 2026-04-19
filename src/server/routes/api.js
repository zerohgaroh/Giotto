"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiRouter = createApiRouter;
var express_1 = require("express");
var multer_1 = __importDefault(require("multer"));
var auth_1 = require("@/lib/staff-backend/auth");
var bootstrap_1 = require("@/lib/staff-backend/bootstrap");
var guest_1 = require("@/lib/staff-backend/guest");
var manager_1 = require("@/lib/staff-backend/manager");
var menu_images_1 = require("@/lib/staff-backend/menu-images");
var projections_1 = require("@/lib/staff-backend/projections");
var route_parsers_1 = require("@/lib/staff-backend/route-parsers");
var restaurant_1 = require("@/lib/staff-backend/restaurant");
var realtime_access_1 = require("@/lib/staff-backend/realtime-access");
var waiter_1 = require("@/lib/staff-backend/waiter");
var projections_2 = require("@/lib/staff-backend/projections");
var seed_1 = require("@/lib/staff-backend/seed");
var realtime_1 = require("@/lib/waiter-backend/realtime");
var auth_2 = require("../auth");
var http_1 = require("../http");
var upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});
function asString(value) {
    return typeof value === "string" ? value : "";
}
function asStringArray(value) {
    return Array.isArray(value) ? value.filter(function (entry) { return typeof entry === "string"; }) : [];
}
function asNumberArray(value) {
    return Array.isArray(value)
        ? value
            .map(function (entry) { return Number(entry); })
            .filter(function (entry) { return Number.isInteger(entry) && entry > 0; })
        : [];
}
function bodyObject(req) {
    return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
}
function parseRequestType(raw) {
    return raw === "bill" ? "bill" : "waiter";
}
function paramString(value) {
    if (typeof value === "string")
        return value;
    if (Array.isArray(value))
        return typeof value[0] === "string" ? value[0] : "";
    return "";
}
function queryString(value) {
    if (typeof value === "string")
        return value;
    if (Array.isArray(value))
        return typeof value[0] === "string" ? value[0] : undefined;
    return undefined;
}
function unauthorizedMessage(error) {
    return error instanceof Error ? error.message : "Unauthorized";
}
function createSseStream(res) {
    var _a;
    res.set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
    });
    (_a = res.flushHeaders) === null || _a === void 0 ? void 0 : _a.call(res);
    return {
        push: function (event, data) {
            res.write("event: ".concat(event, "\ndata: ").concat(JSON.stringify(data), "\n\n"));
        },
        ping: function () {
            res.write(": ping ".concat(Date.now(), "\n\n"));
        },
        close: function () {
            res.end();
        },
    };
}
function createApiRouter() {
    var _this = this;
    var api = (0, express_1.Router)();
    api.get("/restaurant", (0, http_1.asyncHandler)(function (_req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, restaurant_1.getRestaurantData)()];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.put("/restaurant", function (_req, res) {
        (0, http_1.jsonNoStore)(res, {
            error: "Restaurant mutation from web dashboard is deprecated in waiter v1.",
        }, 501);
    });
    api.get("/hall", (0, http_1.asyncHandler)(function (_req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, projections_2.getHallProjection)()];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.put("/hall", function (_req, res) {
        (0, http_1.jsonNoStore)(res, {
            error: "Hall mutation from web dashboard is deprecated in waiter v1.",
        }, 501);
    });
    api.post("/hall/reset", (0, http_1.asyncHandler)(function (_req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, seed_1.resetStaffSeedData)()];
                case 1:
                    _c.sent();
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, projections_2.getHallProjection)()];
                case 2:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/realtime/stream", function (req, res) {
        var stream = createSseStream(res);
        stream.push("ready", { at: Date.now() });
        var unsubscribe = (0, realtime_1.subscribeRealtimeEvents)(function (event) {
            stream.push(event.type, event);
        });
        var heartbeat = setInterval(function () { return stream.ping(); }, 15000);
        req.on("close", function () {
            clearInterval(heartbeat);
            unsubscribe();
            stream.close();
        });
    });
    api.get("/table/:tableId/request", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var type, tableId, cooldown;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    type = parseRequestType(req.query.type);
                    tableId = (0, route_parsers_1.parseTableId)(paramString(req.params.tableId));
                    return [4 /*yield*/, (0, guest_1.getGuestRequestCooldown)({ tableId: tableId, type: type })];
                case 1:
                    cooldown = _a.sent();
                    (0, http_1.jsonNoStore)(res, { cooldown: cooldown });
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/table/:tableId/request", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, type, tableId, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    type = parseRequestType(body.type);
                    tableId = (0, route_parsers_1.parseTableId)(paramString(req.params.tableId));
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, guest_1.createGuestRequest)({
                            tableId: tableId,
                            type: type,
                            reason: typeof body.reason === "string" ? body.reason : undefined,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/table/:tableId/orders", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var tableId, body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    tableId = (0, route_parsers_1.parseTableId)(paramString(req.params.tableId));
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, guest_1.submitGuestOrder)({
                            tableId: tableId,
                            items: Array.isArray(body.items) ? body.items : [],
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/table/:tableId/review", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var tableId, body, rating, _a, _b;
        var _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    tableId = (0, route_parsers_1.parseTableId)(paramString(req.params.tableId));
                    body = bodyObject(req);
                    rating = Number((_d = body.rating) !== null && _d !== void 0 ? _d : 0);
                    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
                        (0, http_1.jsonNoStore)(res, { error: "Оценка должна быть от 1 до 5" }, 400);
                        return [2 /*return*/];
                    }
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    _c = {};
                    return [4 /*yield*/, (0, guest_1.submitGuestReview)({
                            tableId: tableId,
                            rating: rating,
                            comment: typeof body.comment === "string" ? body.comment : undefined,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([(_c.review = _e.sent(),
                            _c)]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/uploads/menu/:filename", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var image;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, menu_images_1.readManagerMenuImage)(paramString(req.params.filename))];
                case 1:
                    image = _a.sent();
                    res.setHeader("Content-Type", image.mimeType);
                    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                    res.status(200).send(image.body);
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/auth/login", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, auth_1.loginStaff)(asString(body.login), asString(body.password))];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/auth/refresh", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, auth_1.refreshStaffSession)(asString(body.refreshToken))];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/auth/logout", (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, auth_1.logoutStaff)({
                            refreshToken: typeof body.refreshToken === "string" ? body.refreshToken : undefined,
                            accessToken: req.get("authorization") || undefined,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/me", (0, auth_2.requireStaffAuth)(), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, bootstrap_1.getStaffBootstrap)(req.staffSession)];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/realtime/stream", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var waiterId, allowedTableIds, accessToken, token, session, waiter, error_1, stream, unsubscribe, heartbeat;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    waiterId = null;
                    allowedTableIds = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    accessToken = queryString(req.query.accessToken);
                    token = req.get("authorization") || (accessToken ? "Bearer ".concat(accessToken) : undefined);
                    return [4 /*yield*/, (0, auth_1.getStaffSession)(token ? token.replace(/^Bearer\s+/i, "") : undefined)];
                case 2:
                    session = _a.sent();
                    if (!session) {
                        throw new Error("Staff authentication is required");
                    }
                    if (!(session.role === "waiter")) return [3 /*break*/, 4];
                    waiterId = session.userId;
                    return [4 /*yield*/, (0, auth_1.getWaiterById)(session.userId)];
                case 3:
                    waiter = _a.sent();
                    if (!waiter) {
                        throw new Error("Unauthorized");
                    }
                    allowedTableIds = new Set(waiter.tableIds);
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    (0, http_1.jsonNoStore)(res, { error: unauthorizedMessage(error_1) }, 401);
                    return [2 /*return*/];
                case 6:
                    stream = createSseStream(res);
                    stream.push("ready", { at: Date.now() });
                    unsubscribe = (0, realtime_1.subscribeRealtimeEvents)(function (event) {
                        (0, realtime_access_1.applyWaiterAssignmentChange)(waiterId, allowedTableIds, event);
                        if (!(0, realtime_access_1.canWaiterReceiveRealtimeEvent)(waiterId, allowedTableIds, event)) {
                            return;
                        }
                        stream.push(event.type, event);
                    });
                    heartbeat = setInterval(function () { return stream.ping(); }, 15000);
                    req.on("close", function () {
                        clearInterval(heartbeat);
                        unsubscribe();
                        stream.close();
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    api.post("/staff/devices/push-token", (0, auth_2.requireStaffAuth)(), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.registerPushDevice)(req.staffSession, {
                            token: asString(body.token),
                            platform: body.platform === "ios" || body.platform === "android" || body.platform === "web" ? body.platform : "expo",
                            appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
                            deviceId: typeof body.deviceId === "string" ? body.deviceId : undefined,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/waiter/tables", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.getWaiterTables)(req.staffSession.userId)];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/waiter/queue", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.getWaiterQueue)(req.staffSession.userId)];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/waiter/shift-summary", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.getWaiterShiftSummary)({
                            waiterId: req.staffSession.userId,
                            sessionId: req.staffSession.sessionId,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api
        .route("/staff/waiter/shortcuts")
        .get((0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.getWaiterShortcuts)(req.staffSession.userId)];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }))
        .put((0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.updateWaiterShortcuts)({
                            waiterId: req.staffSession.userId,
                            payload: {
                                favoriteDishIds: asStringArray(body.favoriteDishIds),
                                noteTemplates: asStringArray(body.noteTemplates),
                                quickOrderPresets: Array.isArray(body.quickOrderPresets) ? body.quickOrderPresets : [],
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/waiter/tables/:tableId", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.getWaiterTableDetail)(req.staffSession.userId, (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)))];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/waiter/tables/:tableId/ack", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.acknowledgeWaiterRequest)({
                            waiterId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                            requestId: typeof body.requestId === "string" ? body.requestId : undefined,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/waiter/tables/:tableId/follow-ups", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.createWaiterFollowUpTask)({
                            waiterId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                            title: asString(body.title),
                            dueInMin: typeof body.dueInMin === "number" ? body.dueInMin : Number((_c = body.dueInMin) !== null && _c !== void 0 ? _c : 0) || undefined,
                            note: typeof body.note === "string" ? body.note : undefined,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_d.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/waiter/tables/:tableId/done", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.markWaiterDone)({
                            waiterId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.patch("/staff/waiter/tables/:tableId/note", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.setWaiterTableNote)({
                            waiterId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                            note: asString(body.note),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/waiter/tables/:tableId/orders", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.addWaiterOrder)({
                            waiterId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                            items: Array.isArray(body.items) ? body.items : [],
                            mutationKey: typeof body.mutationKey === "string" ? body.mutationKey : undefined,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/waiter/tables/:tableId/orders/repeat-last", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.repeatLastWaiterOrder)({
                            waiterId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                            payload: {
                                sourceSessionId: typeof body.sourceSessionId === "string" ? body.sourceSessionId : undefined,
                                mutationKey: typeof body.mutationKey === "string" ? body.mutationKey : undefined,
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/waiter/tasks/:taskId/ack", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.acknowledgeWaiterTask)({
                            waiterId: req.staffSession.userId,
                            taskId: paramString(req.params.taskId),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/waiter/tasks/:taskId/start", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.startWaiterTask)({
                            waiterId: req.staffSession.userId,
                            taskId: paramString(req.params.taskId),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/waiter/tasks/:taskId/complete", (0, auth_2.requireStaffAuth)({ role: "waiter" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, waiter_1.completeWaiterTask)({
                            waiterId: req.staffSession.userId,
                            taskId: paramString(req.params.taskId),
                            mutationKey: typeof body.mutationKey === "string" ? body.mutationKey : undefined,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/manager/hall", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.getManagerHall)(req.staffSession.userId, (0, http_1.getRequestOrigin)(req))];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/manager/history", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.getManagerHistory)({
                            managerId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseOptionalInt)(typeof req.query.tableId === "string" ? req.query.tableId : null),
                            waiterId: typeof req.query.waiterId === "string" ? req.query.waiterId : undefined,
                            type: typeof req.query.type === "string" ? req.query.type : undefined,
                            cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
                            limit: (0, route_parsers_1.parseOptionalInt)(typeof req.query.limit === "string" ? req.query.limit : null, 25),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api
        .route("/staff/manager/layout")
        .get((0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.getManagerLayout)(req.staffSession.userId)];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }))
        .patch((0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.updateManagerLayout)({
                            managerId: req.staffSession.userId,
                            payload: {
                                tables: Array.isArray(body.tables)
                                    ? body.tables.map(function (table) {
                                        var _a, _b;
                                        return ({
                                            tableId: Number(table.tableId),
                                            label: table.label ? String(table.label) : undefined,
                                            zoneId: table.zoneId ? String(table.zoneId) : undefined,
                                            x: Number((_a = table.x) !== null && _a !== void 0 ? _a : 0),
                                            y: Number((_b = table.y) !== null && _b !== void 0 ? _b : 0),
                                            shape: table.shape === "round" ||
                                                table.shape === "rect"
                                                ? table.shape
                                                : "square",
                                            sizePreset: table.sizePreset === "sm" ||
                                                table.sizePreset === "lg"
                                                ? table.sizePreset
                                                : "md",
                                        });
                                    })
                                    : [],
                                zones: Array.isArray(body.zones)
                                    ? body.zones.map(function (zone) {
                                        var _a, _b, _c, _d, _e, _f;
                                        return ({
                                            id: String((_a = zone.id) !== null && _a !== void 0 ? _a : ""),
                                            label: String((_b = zone.label) !== null && _b !== void 0 ? _b : ""),
                                            x: Number((_c = zone.x) !== null && _c !== void 0 ? _c : 0),
                                            y: Number((_d = zone.y) !== null && _d !== void 0 ? _d : 0),
                                            width: Number((_e = zone.width) !== null && _e !== void 0 ? _e : 0),
                                            height: Number((_f = zone.height) !== null && _f !== void 0 ? _f : 0),
                                        });
                                    })
                                    : [],
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api
        .route("/staff/manager/menu")
        .get((0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.getManagerMenuSnapshot)(req.staffSession.userId)];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/manager/menu/categories", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.createManagerMenuCategory)({
                            managerId: req.staffSession.userId,
                            payload: {
                                labelRu: asString(body.labelRu),
                                icon: typeof body.icon === "string" ? body.icon : undefined,
                                sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.patch("/staff/manager/menu/categories/:categoryId", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.updateManagerMenuCategory)({
                            managerId: req.staffSession.userId,
                            categoryId: paramString(req.params.categoryId),
                            payload: {
                                labelRu: asString(body.labelRu),
                                icon: typeof body.icon === "string" ? body.icon : undefined,
                                sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.delete("/staff/manager/menu/categories/:categoryId", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.deleteManagerMenuCategory)({
                            managerId: req.staffSession.userId,
                            categoryId: paramString(req.params.categoryId),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/manager/menu/dishes", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.createManagerDish)({
                            managerId: req.staffSession.userId,
                            payload: {
                                categoryId: asString(body.categoryId),
                                nameRu: asString(body.nameRu),
                                nameIt: asString(body.nameIt),
                                description: asString(body.description),
                                price: Number((_c = body.price) !== null && _c !== void 0 ? _c : 0),
                                image: asString(body.image),
                                portion: asString(body.portion),
                                energyKcal: Number((_d = body.energyKcal) !== null && _d !== void 0 ? _d : 0),
                                badgeLabel: typeof body.badgeLabel === "string" ? body.badgeLabel : undefined,
                                badgeTone: body.badgeTone === "gold" || body.badgeTone === "navy" || body.badgeTone === "sage" || body.badgeTone === "blush"
                                    ? body.badgeTone
                                    : undefined,
                                highlight: Boolean(body.highlight),
                                available: body.available !== false,
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_e.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.patch("/staff/manager/menu/dishes/:dishId", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.updateManagerDish)({
                            managerId: req.staffSession.userId,
                            dishId: paramString(req.params.dishId),
                            payload: {
                                categoryId: asString(body.categoryId),
                                nameRu: asString(body.nameRu),
                                nameIt: asString(body.nameIt),
                                description: asString(body.description),
                                price: Number((_c = body.price) !== null && _c !== void 0 ? _c : 0),
                                image: asString(body.image),
                                portion: asString(body.portion),
                                energyKcal: Number((_d = body.energyKcal) !== null && _d !== void 0 ? _d : 0),
                                badgeLabel: typeof body.badgeLabel === "string" ? body.badgeLabel : undefined,
                                badgeTone: body.badgeTone === "gold" || body.badgeTone === "navy" || body.badgeTone === "sage" || body.badgeTone === "blush"
                                    ? body.badgeTone
                                    : undefined,
                                highlight: Boolean(body.highlight),
                                available: body.available !== false,
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_e.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.delete("/staff/manager/menu/dishes/:dishId", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.deleteManagerDish)({
                            managerId: req.staffSession.userId,
                            dishId: paramString(req.params.dishId),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/manager/menu/dishes/:dishId/toggle-availability", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.toggleManagerDishAvailability)({
                            managerId: req.staffSession.userId,
                            dishId: paramString(req.params.dishId),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/manager/menu/images", (0, auth_2.requireStaffAuth)({ role: "manager" }), upload.single("file"), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var file, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!req.file) {
                        throw new projections_1.ApiError(400, "Image file is required");
                    }
                    file = new File([new Uint8Array(req.file.buffer)], req.file.originalname, {
                        type: req.file.mimetype,
                    });
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, menu_images_1.saveManagerMenuImage)(file, (0, http_1.toFetchRequest)(req))];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.patch("/staff/manager/menu/reorder", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.reorderManagerMenu)({
                            managerId: req.staffSession.userId,
                            categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds.filter(function (entry) { return typeof entry === "string"; }) : undefined,
                            dishIdsByCategory: body.dishIdsByCategory && typeof body.dishIdsByCategory === "object" && !Array.isArray(body.dishIdsByCategory)
                                ? Object.fromEntries(Object.entries(body.dishIdsByCategory).map(function (_a) {
                                    var key = _a[0], value = _a[1];
                                    return [key, asStringArray(value)];
                                }))
                                : undefined,
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api
        .route("/staff/manager/tables")
        .post((0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.createManagerTable)({
                            managerId: req.staffSession.userId,
                            payload: {
                                label: typeof body.label === "string" ? body.label : undefined,
                                zoneId: typeof body.zoneId === "string" ? body.zoneId : undefined,
                                shape: body.shape === "round" || body.shape === "rect" ? body.shape : undefined,
                                sizePreset: body.sizePreset === "sm" || body.sizePreset === "md" || body.sizePreset === "lg" ? body.sizePreset : undefined,
                                x: typeof body.x === "number" ? body.x : undefined,
                                y: typeof body.y === "number" ? body.y : undefined,
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/manager/tables/:tableId", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.getManagerTableDetail)(req.staffSession.userId, (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)), (0, http_1.getRequestOrigin)(req))];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/manager/tables/:tableId/reassign", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.reassignManagerTable)({
                            managerId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                            waiterId: typeof body.waiterId === "string" && body.waiterId.trim() ? body.waiterId : undefined,
                            publicBaseUrl: (0, http_1.getRequestOrigin)(req),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/manager/tables/:tableId/close", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.closeManagerTable)({
                            managerId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                            publicBaseUrl: (0, http_1.getRequestOrigin)(req),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/manager/tables/:tableId/archive", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.archiveManagerTable)({
                            managerId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/manager/tables/:tableId/restore", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.restoreManagerTable)({
                            managerId: req.staffSession.userId,
                            tableId: (0, route_parsers_1.parseTableId)(paramString(req.params.tableId)),
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api
        .route("/staff/manager/waiters")
        .get((0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.listManagerWaiters)(req.staffSession.userId)];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }))
        .post((0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.createManagerWaiter)({
                            managerId: req.staffSession.userId,
                            payload: {
                                name: asString(body.name),
                                login: asString(body.login),
                                password: asString(body.password),
                                tableIds: asNumberArray(body.tableIds),
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.get("/staff/manager/waiters/:waiterId", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.getManagerWaiterDetail)(req.staffSession.userId, paramString(req.params.waiterId))];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.patch("/staff/manager/waiters/:waiterId", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.updateManagerWaiter)({
                            managerId: req.staffSession.userId,
                            waiterId: paramString(req.params.waiterId),
                            payload: {
                                name: typeof body.name === "string" ? body.name : undefined,
                                login: typeof body.login === "string" ? body.login : undefined,
                                active: typeof body.active === "boolean" ? body.active : undefined,
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.post("/staff/manager/waiters/:waiterId/reset-password", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.resetManagerWaiterPassword)({
                            managerId: req.staffSession.userId,
                            waiterId: paramString(req.params.waiterId),
                            payload: {
                                password: asString(body.password),
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.put("/staff/manager/waiters/:waiterId/assignments", (0, auth_2.requireStaffAuth)({ role: "manager" }), (0, http_1.asyncHandler)(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var body, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    body = bodyObject(req);
                    _a = http_1.jsonNoStore;
                    _b = [res];
                    return [4 /*yield*/, (0, manager_1.replaceManagerWaiterAssignments)({
                            managerId: req.staffSession.userId,
                            waiterId: paramString(req.params.waiterId),
                            payload: {
                                tableIds: asNumberArray(body.tableIds),
                            },
                        })];
                case 1:
                    _a.apply(void 0, _b.concat([_c.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
    api.use(function (error, _req, res, _next) {
        (0, http_1.sendApiError)(res, error);
    });
    return api;
}

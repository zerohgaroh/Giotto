"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
exports.applyNoStore = applyNoStore;
exports.jsonNoStore = jsonNoStore;
exports.sendApiError = sendApiError;
exports.isHtmxRequest = isHtmxRequest;
exports.serializeForScript = serializeForScript;
exports.getRequestOrigin = getRequestOrigin;
exports.getAbsoluteUrl = getAbsoluteUrl;
exports.toFetchRequest = toFetchRequest;
exports.wantsHtml = wantsHtml;
var projections_1 = require("@/lib/staff-backend/projections");
function asyncHandler(handler) {
    return function (req, res, next) {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}
function applyNoStore(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
}
function jsonNoStore(res, payload, status) {
    if (status === void 0) { status = 200; }
    applyNoStore(res);
    res.status(status).json(payload);
}
function sendApiError(res, error) {
    if (error instanceof projections_1.ApiError) {
        return jsonNoStore(res, { error: error.message }, error.status);
    }
    if (error instanceof Error) {
        return jsonNoStore(res, { error: error.message }, 500);
    }
    return jsonNoStore(res, { error: "Внутренняя ошибка сервера" }, 500);
}
function isHtmxRequest(req) {
    return req.get("HX-Request") === "true";
}
function serializeForScript(value) {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
}
function getRequestOrigin(req) {
    var _a, _b, _c, _d, _e;
    var configured = (_a = process.env.GIOTTO_PUBLIC_BASE_URL) === null || _a === void 0 ? void 0 : _a.trim();
    if (configured) {
        return configured.replace(/\/$/, "");
    }
    var protocol = ((_c = (_b = req.get("x-forwarded-proto")) === null || _b === void 0 ? void 0 : _b.split(",")[0]) === null || _c === void 0 ? void 0 : _c.trim()) || req.protocol;
    var host = ((_e = (_d = req.get("x-forwarded-host")) === null || _d === void 0 ? void 0 : _d.split(",")[0]) === null || _e === void 0 ? void 0 : _e.trim()) || req.get("host") || "localhost:3000";
    return "".concat(protocol, "://").concat(host).replace(/\/$/, "");
}
function getAbsoluteUrl(req) {
    return "".concat(getRequestOrigin(req)).concat(req.originalUrl);
}
function toFetchRequest(req) {
    var headers = new Headers();
    for (var _i = 0, _a = Object.entries(req.headers); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (Array.isArray(value)) {
            for (var _c = 0, value_1 = value; _c < value_1.length; _c++) {
                var entry = value_1[_c];
                headers.append(key, entry);
            }
            continue;
        }
        if (typeof value === "string") {
            headers.set(key, value);
        }
    }
    return new Request(getAbsoluteUrl(req), {
        method: req.method,
        headers: headers,
    });
}
function wantsHtml(req) {
    var accept = req.get("accept") || "";
    return accept.includes("text/html");
}

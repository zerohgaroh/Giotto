"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireGuestTableAccess = exports.GUEST_ERROR_TEXT = void 0;
exports.buildGuestRedirectPath = buildGuestRedirectPath;
exports.createGuestAccessHandler = createGuestAccessHandler;
exports.getGuestErrorText = getGuestErrorText;
exports.buildTableLocals = buildTableLocals;
var guest_auth_1 = require("@/lib/guest-auth");
var table_label_1 = require("@/lib/table-label");
exports.GUEST_ERROR_TEXT = {
    "invalid-link": "Ссылка стола недействительна. Откройте страницу через NFC-метку вашего стола.",
    "missing-access-key": "Нужна персональная ссылка стола. Откройте страницу через NFC-метку вашего стола.",
};
function guestCookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 12 * 1000,
    };
}
function buildGuestRedirectPath(tableId, accessKey) {
    return {
        shortPath: "/t/".concat(encodeURIComponent(tableId), "/").concat(accessKey),
        tablePath: "/table/".concat(encodeURIComponent(tableId)),
        menuPath: "/table/".concat(encodeURIComponent(tableId), "/menu"),
        cartPath: "/table/".concat(encodeURIComponent(tableId), "/cart"),
        waiterPath: "/table/".concat(encodeURIComponent(tableId), "/waiter"),
        complaintPath: "/table/".concat(encodeURIComponent(tableId), "/complaint"),
    };
}
function createGuestAccessHandler() {
    return function (req, res) {
        var _a, _b;
        var tableId = (0, guest_auth_1.normalizeTableId)(String((_a = req.params.tableId) !== null && _a !== void 0 ? _a : ""));
        var accessKey = (0, guest_auth_1.normalizeGuestAccessKey)(String((_b = req.params.accessKey) !== null && _b !== void 0 ? _b : ""));
        if (!tableId || !accessKey || !(0, guest_auth_1.isValidGuestAccessKey)(tableId, accessKey)) {
            res.redirect("/guest?error=invalid-link");
            return;
        }
        res.cookie(guest_auth_1.GUEST_TABLE_COOKIE, (0, guest_auth_1.buildGuestSessionValue)(tableId, accessKey), guestCookieOptions());
        res.redirect(buildGuestRedirectPath(tableId, accessKey).tablePath);
    };
}
var requireGuestTableAccess = function (req, res, next) {
    var _a, _b;
    var tableId = (0, guest_auth_1.normalizeTableId)(String((_a = req.params.tableId) !== null && _a !== void 0 ? _a : ""));
    if (!tableId) {
        res.redirect("/guest?error=invalid-link");
        return;
    }
    if (!(0, guest_auth_1.hasGuestAccessToTable)((_b = req.cookies) === null || _b === void 0 ? void 0 : _b[guest_auth_1.GUEST_TABLE_COOKIE], tableId)) {
        res.redirect("/guest?error=invalid-link");
        return;
    }
    req.guestTableId = tableId;
    next();
};
exports.requireGuestTableAccess = requireGuestTableAccess;
function getGuestErrorText(error) {
    if (typeof error !== "string")
        return undefined;
    return exports.GUEST_ERROR_TEXT[error];
}
function buildTableLocals(tableId) {
    var paths = buildGuestRedirectPath(tableId, "");
    return {
        tableId: tableId,
        tableLabel: (0, table_label_1.tableLabelFromId)(tableId),
        tablePath: paths.tablePath,
        menuPath: paths.menuPath,
        cartPath: paths.cartPath,
        waiterPath: paths.waiterPath,
        complaintPath: paths.complaintPath,
    };
}

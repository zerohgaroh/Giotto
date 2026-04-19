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
exports.createApp = createApp;
var cookie_parser_1 = __importDefault(require("cookie-parser"));
var express_1 = __importDefault(require("express"));
var path_1 = __importDefault(require("path"));
var maintenance_1 = require("@/lib/staff-backend/maintenance");
var api_1 = require("./routes/api");
var web_1 = require("./routes/web");
var http_1 = require("./http");
function createApp() {
    return __awaiter(this, void 0, void 0, function () {
        var app;
        return __generator(this, function (_a) {
            app = (0, express_1.default)();
            app.disable("x-powered-by");
            app.set("view engine", "ejs");
            app.set("views", path_1.default.join(process.cwd(), "views"));
            app.locals.serialize = http_1.serializeForScript;
            app.use((0, cookie_parser_1.default)());
            app.use(express_1.default.urlencoded({ extended: true }));
            app.use(express_1.default.json({ limit: "6mb" }));
            app.use("/assets", express_1.default.static(path_1.default.join(process.cwd(), "public", "assets")));
            app.use(express_1.default.static(path_1.default.join(process.cwd(), "public")));
            app.use(function (req, res, next) {
                res.locals.assetCssPath = "/assets/app.css";
                res.locals.assetJsPath = "/assets/guest.js";
                res.locals.currentPath = req.path;
                next();
            });
            app.use(function (req, _res, next) {
                if (req.path.startsWith("/assets") || req.path.startsWith("/brand")) {
                    next();
                    return;
                }
                (0, maintenance_1.maybeRunStaffBackendMaintenance)()
                    .catch(function (error) {
                    console.error("[maintenance] failed");
                    console.error(error);
                })
                    .finally(function () { return next(); });
            });
            app.use("/api", (0, api_1.createApiRouter)());
            app.use("/", (0, web_1.createWebRouter)());
            app.use(function (req, res) {
                if (req.path.startsWith("/api")) {
                    res.status(404).json({ error: "Not found" });
                    return;
                }
                if ((0, http_1.wantsHtml)(req)) {
                    res.redirect("/guest");
                    return;
                }
                res.status(404).send("Not found");
            });
            return [2 /*return*/, app];
        });
    });
}

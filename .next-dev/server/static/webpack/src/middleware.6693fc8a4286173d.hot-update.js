"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
self["webpackHotUpdate_N_E"]("src/middleware",{

/***/ "(middleware)/./src/middleware.ts":
/*!***************************!*\
  !*** ./src/middleware.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   config: () => (/* binding */ config),\n/* harmony export */   middleware: () => (/* binding */ middleware)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(middleware)/./node_modules/next/dist/esm/api/server.js\");\n\n/**\n * In dev, Safari often keeps a cached HTML document that still references old\n * hashed `/_next/static/*` files after a restart → red rows in Network, no CSS/JS.\n * Disable caching for document navigations only (not `/_next/static`).\n */ function middleware() {\n    const res = next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.next();\n    if (true) {\n        res.headers.set(\"Cache-Control\", \"no-store, no-cache, must-revalidate, max-age=0\");\n    }\n    return res;\n}\nconst config = {\n    matcher: [\n        \"/\",\n        \"/table/:path*\",\n        \"/t/:path*\",\n        \"/waiter/:path*\"\n    ]\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKG1pZGRsZXdhcmUpLy4vc3JjL21pZGRsZXdhcmUudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQTJDO0FBRTNDOzs7O0NBSUMsR0FDTSxTQUFTQztJQUNkLE1BQU1DLE1BQU1GLHFEQUFZQSxDQUFDRyxJQUFJO0lBQzdCLElBQUlDLElBQXNDLEVBQUU7UUFDMUNGLElBQUlHLE9BQU8sQ0FBQ0MsR0FBRyxDQUNiLGlCQUNBO0lBRUo7SUFDQSxPQUFPSjtBQUNUO0FBRU8sTUFBTUssU0FBUztJQUNwQkMsU0FBUztRQUFDO1FBQUs7UUFBaUI7UUFBYTtLQUFpQjtBQUNoRSxFQUFFIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vX05fRS8uL3NyYy9taWRkbGV3YXJlLnRzP2QxOTkiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTmV4dFJlc3BvbnNlIH0gZnJvbSBcIm5leHQvc2VydmVyXCI7XG5cbi8qKlxuICogSW4gZGV2LCBTYWZhcmkgb2Z0ZW4ga2VlcHMgYSBjYWNoZWQgSFRNTCBkb2N1bWVudCB0aGF0IHN0aWxsIHJlZmVyZW5jZXMgb2xkXG4gKiBoYXNoZWQgYC9fbmV4dC9zdGF0aWMvKmAgZmlsZXMgYWZ0ZXIgYSByZXN0YXJ0IOKGkiByZWQgcm93cyBpbiBOZXR3b3JrLCBubyBDU1MvSlMuXG4gKiBEaXNhYmxlIGNhY2hpbmcgZm9yIGRvY3VtZW50IG5hdmlnYXRpb25zIG9ubHkgKG5vdCBgL19uZXh0L3N0YXRpY2ApLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWlkZGxld2FyZSgpIHtcbiAgY29uc3QgcmVzID0gTmV4dFJlc3BvbnNlLm5leHQoKTtcbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcImRldmVsb3BtZW50XCIpIHtcbiAgICByZXMuaGVhZGVycy5zZXQoXG4gICAgICBcIkNhY2hlLUNvbnRyb2xcIixcbiAgICAgIFwibm8tc3RvcmUsIG5vLWNhY2hlLCBtdXN0LXJldmFsaWRhdGUsIG1heC1hZ2U9MFwiLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxuZXhwb3J0IGNvbnN0IGNvbmZpZyA9IHtcbiAgbWF0Y2hlcjogW1wiL1wiLCBcIi90YWJsZS86cGF0aCpcIiwgXCIvdC86cGF0aCpcIiwgXCIvd2FpdGVyLzpwYXRoKlwiXSxcbn07XG4iXSwibmFtZXMiOlsiTmV4dFJlc3BvbnNlIiwibWlkZGxld2FyZSIsInJlcyIsIm5leHQiLCJwcm9jZXNzIiwiaGVhZGVycyIsInNldCIsImNvbmZpZyIsIm1hdGNoZXIiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(middleware)/./src/middleware.ts\n");

/***/ })

});
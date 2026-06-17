"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vitest_1 = require("vitest");
const semanticSummary_1 = require("../../src/views/semanticSummary");
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "../../test-fixtures/compiler-output", name), "utf8"));
(0, vitest_1.describe)("semantic summary normalization", () => {
    (0, vitest_1.it)("normalizes capabilities and capability children", () => {
        const summary = (0, semanticSummary_1.summarizeCompilerOutput)(fixture("relative-source-location.json"));
        (0, vitest_1.expect)(summary.capabilities[0].name).toBe("RelativeLocationCapability");
        (0, vitest_1.expect)(summary.capabilities[0].events).toEqual(["BatchArchived"]);
        (0, vitest_1.expect)(summary.capabilities[0].itemLocations?.events?.BatchArchived?.file).toContain("valid-summary.dcl");
    });
    (0, vitest_1.it)("normalizes top-level semantic groups", () => {
        const summary = (0, semanticSummary_1.summarizeCompilerOutput)({
            contexts: [{ name: "Sales" }],
            actors: [{ name: "Customer" }],
            policies: [{ name: "Audit" }],
            effects: [{ name: "PersistOrder" }],
            events: [{ name: "OrderAccepted" }],
            capabilities: [{ name: "AcceptOrder", lifecycle: { name: "AcceptOrder" } }],
        });
        (0, vitest_1.expect)(summary.contexts?.map((item) => item.name)).toEqual(["Sales"]);
        (0, vitest_1.expect)(summary.actors?.map((item) => item.label)).toEqual(["Customer"]);
        (0, vitest_1.expect)(summary.policies?.map((item) => item.label)).toEqual(["Audit"]);
        (0, vitest_1.expect)(summary.effects?.map((item) => item.label)).toEqual(["PersistOrder"]);
        (0, vitest_1.expect)(summary.events?.map((item) => item.label)).toEqual(["OrderAccepted"]);
        (0, vitest_1.expect)(summary.lifecycles?.map((item) => item.label)).toEqual(["AcceptOrder"]);
    });
    (0, vitest_1.it)("handles missing optional arrays and invalid summary shapes", () => {
        (0, vitest_1.expect)((0, semanticSummary_1.summarizeCompilerOutput)({}).capabilities).toEqual([]);
        const summary = (0, semanticSummary_1.summarizeCompilerOutput)(fixture("invalid-summary-shape.json"));
        (0, vitest_1.expect)(summary.capabilities).toEqual([]);
        (0, vitest_1.expect)(summary.actors?.map((item) => item.label)).toEqual(["StillDefensive"]);
    });
});
//# sourceMappingURL=semanticSummary.test.js.map
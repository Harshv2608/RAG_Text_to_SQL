"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const query_1 = __importDefault(require("./routes/query"));
const eval_1 = __importDefault(require("./routes/eval"));
const health_1 = __importDefault(require("./routes/health"));
const metrics_1 = __importDefault(require("./routes/metrics"));
const benchmark_1 = __importDefault(require("./routes/benchmark"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
exports.app.use('/query', query_1.default);
exports.app.use('/eval', eval_1.default);
exports.app.use('/health', health_1.default);
exports.app.use('/metrics', metrics_1.default);
exports.app.use('/benchmark', benchmark_1.default);
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    exports.app.listen(PORT, () => console.log(`Gateway listening on port ${PORT}`));
}
//# sourceMappingURL=index.js.map
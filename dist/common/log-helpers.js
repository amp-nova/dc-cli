"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
function getDefaultLogPath(type, action, platform = process.platform) {
    return path_1.join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', `logs/${type}-${action}-<DATE>.log`);
}
exports.getDefaultLogPath = getDefaultLogPath;

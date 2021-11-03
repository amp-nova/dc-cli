"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const url_1 = require("url");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function jsonResolver(jsonToResolve = '', relativeDir = __dirname) {
    try {
        const resolvedJson = JSON.parse(jsonToResolve);
        if (resolvedJson && (Array.isArray(resolvedJson) || typeof resolvedJson === 'object')) {
            return jsonToResolve;
        }
    }
    catch (_a) { }
    if (jsonToResolve.match(/^(http|https):\/\//)) {
        const result = await axios_1.default.get(jsonToResolve, { transformResponse: data => data });
        return result.data;
    }
    let resolvedFilename = jsonToResolve;
    if (jsonToResolve.match(/file:\/\//)) {
        resolvedFilename = new url_1.URL(jsonToResolve);
    }
    else if (jsonToResolve.split(path.sep)[0].match(/^\.{1,2}$/)) {
        resolvedFilename = path.resolve(relativeDir, jsonToResolve);
    }
    if (!fs.existsSync(resolvedFilename)) {
        throw new Error(`Cannot find JSON file "${jsonToResolve}" using relative dir "${relativeDir}" (resolved path "${resolvedFilename}")`);
    }
    return fs.readFileSync(resolvedFilename, 'utf-8');
}
exports.jsonResolver = jsonResolver;

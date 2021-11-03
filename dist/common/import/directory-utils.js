"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const fs_1 = require("fs");
const path_1 = require("path");
async function ensureDirectoryExists(dir) {
    if (await util_1.promisify(fs_1.exists)(dir)) {
        const dirStat = await util_1.promisify(fs_1.lstat)(dir);
        if (!dirStat || !dirStat.isDirectory()) {
            throw new Error(`"${dir}" already exists and is not a directory.`);
        }
    }
    else {
        const parentPath = dir.split(path_1.sep);
        parentPath.pop();
        const parent = parentPath.join(path_1.sep);
        if (parentPath.length > 0) {
            await ensureDirectoryExists(parent);
        }
        if (dir.length > 0) {
            try {
                await util_1.promisify(fs_1.mkdir)(dir);
            }
            catch (e) {
                if (await util_1.promisify(fs_1.exists)(dir)) {
                    return;
                }
                throw new Error(`Unable to create directory: "${dir}".`);
            }
        }
    }
}
exports.ensureDirectoryExists = ensureDirectoryExists;

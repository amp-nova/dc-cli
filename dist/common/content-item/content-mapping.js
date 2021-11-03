"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const util_1 = require("util");
class ContentMapping {
    constructor() {
        this.contentItems = new Map();
    }
    getContentItem(id) {
        if (id === undefined) {
            return undefined;
        }
        return this.contentItems.get(id);
    }
    registerContentItem(fromId, toId) {
        this.contentItems.set(fromId, toId);
    }
    async save(filename) {
        const obj = {
            contentItems: Array.from(this.contentItems)
        };
        const text = JSON.stringify(obj);
        const dir = path_1.dirname(filename);
        if (!(await util_1.promisify(fs_1.exists)(dir))) {
            await util_1.promisify(fs_1.mkdir)(dir);
        }
        await util_1.promisify(fs_1.writeFile)(filename, text, { encoding: 'utf8' });
    }
    async load(filename) {
        try {
            const text = await util_1.promisify(fs_1.readFile)(filename, { encoding: 'utf8' });
            const obj = JSON.parse(text);
            this.contentItems = new Map(obj.contentItems);
            return true;
        }
        catch (e) {
            return false;
        }
    }
}
exports.ContentMapping = ContentMapping;

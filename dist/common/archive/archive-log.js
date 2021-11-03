"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const util_1 = require("util");
class ArchiveLog {
    constructor(title) {
        this.title = title;
        this.items = [];
    }
    async loadFromFile(path) {
        const log = await util_1.promisify(fs_1.readFile)(path, 'utf8');
        const logLines = log.split('\n');
        this.items = [];
        logLines.forEach(line => {
            if (line.startsWith('//')) {
                const message = line.substring(2).trimLeft();
                if (this.title == null) {
                    this.title = message;
                }
                else {
                    this.addComment(message);
                }
                return;
            }
            const lineSplit = line.split(' ');
            if (lineSplit.length >= 2) {
                this.addAction(lineSplit[0], lineSplit.slice(1).join(' '));
            }
        });
        return this;
    }
    async writeToFile(path) {
        try {
            let log = `// ${this.title}\n`;
            this.items.forEach(item => {
                if (item.comment) {
                    log += `// ${item.data}\n`;
                }
                else {
                    log += `${item.action} ${item.data}\n`;
                }
            });
            const dir = path_1.dirname(path);
            if (!(await util_1.promisify(fs_1.exists)(dir))) {
                await util_1.promisify(fs_1.mkdir)(dir);
            }
            await util_1.promisify(fs_1.writeFile)(path, log);
            console.log(`Log written to "${path}".`);
            return true;
        }
        catch (_a) {
            console.log('Could not write log.');
            return false;
        }
    }
    addComment(comment) {
        const lines = comment.split('\n');
        lines.forEach(line => {
            this.items.push({ comment: true, data: line });
        });
    }
    addAction(action, data) {
        this.items.push({ comment: false, action: action, data: data });
    }
    getData(action) {
        return this.items.filter(item => !item.comment && item.action === action).map(item => item.data);
    }
}
exports.ArchiveLog = ArchiveLog;

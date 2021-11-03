"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const archive_log_1 = require("./archive/archive-log");
class FileLog extends archive_log_1.ArchiveLog {
    constructor(filename) {
        super((filename || '').replace('<DATE>', Date.now().toString()));
        this.filename = filename;
        if (this.filename != null) {
            const timestamp = Date.now().toString();
            this.filename = this.filename.replace('<DATE>', timestamp);
        }
    }
    appendLine(text) {
        console.log(text);
        this.addComment(text);
    }
    async close() {
        if (this.filename != null) {
            await this.writeToFile(this.filename);
        }
        this.closed = true;
    }
}
exports.FileLog = FileLog;

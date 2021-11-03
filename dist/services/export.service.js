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
const fs_1 = __importDefault(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const data_presenter_1 = __importDefault(require("../view/data-presenter"));
const readline_1 = __importDefault(require("readline"));
exports.uniqueFilenamePath = (dir, file = '', extension, exportFilenames) => {
    if (dir.substr(-1) === path.sep) {
        dir = dir.slice(0, -1);
    }
    let counter = 0;
    let uniqueFilename = '';
    do {
        if (counter == 0) {
            uniqueFilename = dir + path.sep + file + '.' + extension;
        }
        else {
            uniqueFilename = dir + path.sep + file + '-' + counter + '.' + extension;
        }
        counter++;
    } while (exportFilenames.find(filename => uniqueFilename.toLowerCase() === filename.toLowerCase()));
    return uniqueFilename;
};
exports.uniqueFilename = (dir, uri = '', extension, exportFilenames) => {
    const url = new url_1.URL(uri);
    const file = path.basename(url.pathname, '.' + extension) || url.hostname.replace('.', '_');
    return exports.uniqueFilenamePath(dir, file, extension, exportFilenames);
};
exports.writeJsonToFile = (filename, resource) => {
    try {
        fs_1.default.writeFileSync(filename, JSON.stringify(resource, null, 2));
    }
    catch (e) {
        throw new Error(`Unable to write file: ${filename}, aborting export`);
    }
};
exports.promptToOverwriteExports = (updatedExportsMap) => {
    return new Promise((resolve) => {
        process.stdout.write('The following files will be overwritten:\n');
        const itemMapFn = ({ filename, schemaId }) => ({
            File: filename,
            'Schema ID': schemaId
        });
        new data_presenter_1.default(updatedExportsMap).render({ itemMapFn });
        const rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Do you want to continue (y/n)?: ', answer => {
            rl.close();
            return resolve(answer === 'y');
        });
    });
};
exports.promptToExportSettings = (filename) => {
    return new Promise((resolve) => {
        const rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(`Do you want to export setting to ${filename} (y/n)?: `, answer => {
            rl.close();
            return resolve(answer === 'y');
        });
    });
};
exports.nothingExportedExit = (msg = 'Nothing was exported, exiting.\n') => {
    process.stdout.write(msg);
    process.exit(1);
};

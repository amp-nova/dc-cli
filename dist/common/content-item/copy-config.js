"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const util_1 = require("util");
class CopyConfigFile {
    async save(filename) {
        const text = JSON.stringify(this.config);
        const dir = path_1.dirname(filename);
        if (!fs_1.existsSync(dir)) {
            await util_1.promisify(fs_1.mkdir)(dir);
        }
        await util_1.promisify(fs_1.writeFile)(filename, text, { encoding: 'utf8' });
    }
    async load(filename) {
        let text;
        try {
            text = await util_1.promisify(fs_1.readFile)(filename, { encoding: 'utf8' });
        }
        catch (e) {
            return false;
        }
        this.config = JSON.parse(text);
        return true;
    }
}
exports.CopyConfigFile = CopyConfigFile;
async function loadCopyConfig(argv, log) {
    let copyConfig = {
        srcHubId: argv.hubId,
        srcClientId: argv.clientId,
        srcSecret: argv.clientSecret,
        dstHubId: argv.dstHubId || argv.hubId,
        dstClientId: argv.dstClientId || argv.clientId,
        dstSecret: argv.dstSecret || argv.clientSecret
    };
    if (argv.copyConfig != null && typeof argv.copyConfig === 'string') {
        const configFile = new CopyConfigFile();
        let exists = false;
        try {
            exists = await configFile.load(argv.copyConfig);
        }
        catch (e) {
            log.addComment(`Failed to load configuration file: ${e.toString()}`);
            await log.close();
            return null;
        }
        if (exists) {
            copyConfig = configFile.config;
        }
        else {
            configFile.config = copyConfig;
            try {
                configFile.save(argv.copyConfig);
            }
            catch (e) {
                log.addComment(`Failed to save configuration file: ${e.toString()}`);
                log.addComment('Continuing.');
            }
        }
    }
    return copyConfig;
}
exports.loadCopyConfig = loadCopyConfig;

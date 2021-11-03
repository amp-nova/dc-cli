"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const lodash_1 = require("lodash");
exports.command = 'configure';
exports.desc = 'Saves the configuration options to a file';
exports.CONFIG_FILENAME = (platform = process.platform) => path_1.join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', 'dc-cli-config.json');
exports.configureCommandOptions = {
    clientId: { type: 'string', demandOption: true },
    clientSecret: { type: 'string', demandOption: true },
    hubId: { type: 'string', demandOption: true },
    config: { type: 'string', default: exports.CONFIG_FILENAME() }
};
const writeConfigFile = (configFile, parameters) => {
    const dir = path_1.dirname(configFile);
    if (!fs_1.default.existsSync(dir)) {
        try {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        catch (err) {
            throw new Error(`Unable to create dir "${dir}". Reason: ${err}`);
        }
    }
    try {
        fs_1.default.writeFileSync(configFile, JSON.stringify(parameters));
    }
    catch (err) {
        throw new Error(`Unable to write config file "${configFile}". Reason: ${err}`);
    }
};
exports.readConfigFile = (configFile) => fs_1.default.existsSync(configFile) ? JSON.parse(fs_1.default.readFileSync(configFile, 'utf-8')) : {};
exports.handler = (argv) => {
    const { clientId, clientSecret, hubId } = argv;
    const storedConfig = exports.readConfigFile(exports.CONFIG_FILENAME());
    if (lodash_1.isEqual(storedConfig, { clientId, clientSecret, hubId })) {
        console.log('Config file up-to-date.  Please use `--help` for command usage.');
        return;
    }
    writeConfigFile(exports.CONFIG_FILENAME(), { clientId, clientSecret, hubId });
    console.log('Config file updated.');
};

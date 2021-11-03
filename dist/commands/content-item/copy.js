"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const log_helpers_1 = require("../../common/log-helpers");
const path_1 = require("path");
const rimraf_1 = __importDefault(require("rimraf"));
const export_1 = require("./export");
const import_1 = require("./import");
const directory_utils_1 = require("../../common/import/directory-utils");
const file_log_1 = require("../../common/file-log");
const import_revert_1 = require("./import-revert");
const copy_config_1 = require("../../common/content-item/copy-config");
function getTempFolder(name, platform = process.platform) {
    return path_1.join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', `copy-${name}/`);
}
exports.getTempFolder = getTempFolder;
exports.command = 'copy';
exports.desc = 'Copy content items. The active account and hub are the source for the copy.';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('item', 'copy', platform);
exports.builder = (yargs) => {
    yargs
        .option('revertLog', {
        type: 'string',
        describe: 'Path to a log file to revert a copy for. This will archive the most recently copied resources, and revert updated ones.'
    })
        .option('srcRepo', {
        type: 'string',
        describe: 'Copy content from within a given repository. Directory structure will start at the specified repository. Will automatically export all contained folders.'
    })
        .option('srcFolder', {
        type: 'string',
        describe: 'Copy content from within a given folder. Directory structure will start at the specified folder. Can be used in addition to repoId.'
    })
        .option('dstRepo', {
        type: 'string',
        describe: 'Copy matching the given repository to the source base directory, by ID. Folder structure will be followed and replicated from there.'
    })
        .option('dstFolder', {
        type: 'string',
        describe: 'Copy matching the given folder to the source base directory, by ID. Folder structure will be followed and replicated from there.'
    })
        .option('dstHubId', {
        type: 'string',
        describe: 'Destination hub ID. If not specified, it will be the same as the source.'
    })
        .option('dstClientId', {
        type: 'string',
        describe: "Destination account's client ID. If not specified, it will be the same as the source."
    })
        .option('dstSecret', {
        type: 'string',
        describe: "Destination account's secret. Must be used alongside dstClientId."
    })
        .option('mapFile', {
        type: 'string',
        describe: 'Mapping file to use when updating content that already exists. Updated with any new mappings that are generated. If not present, will be created.'
    })
        .alias('f', 'force')
        .option('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite content, create and assign content types, and ignore content with missing types/references without asking.'
    })
        .alias('v', 'validate')
        .option('v', {
        type: 'boolean',
        boolean: true,
        describe: 'Only recreate folder structure - content is validated but not imported.'
    })
        .option('skipIncomplete', {
        type: 'boolean',
        boolean: true,
        describe: 'Skip any content item that has one or more missing dependancy.'
    })
        .option('copyConfig', {
        type: 'string',
        describe: 'Path to a JSON configuration file for source/destination account. If the given file does not exist, it will be generated from the arguments.'
    })
        .option('lastPublish', {
        type: 'boolean',
        boolean: true,
        describe: 'When available, export the last published version of a content item rather than its newest version.'
    })
        .option('publish', {
        type: 'boolean',
        boolean: true,
        describe: 'Publish any content items that have an existing publish status in their JSON.'
    })
        .option('republish', {
        type: 'boolean',
        boolean: true,
        describe: 'Republish content items regardless of whether the import changed them or not. (--publish not required)'
    })
        .option('excludeKeys', {
        type: 'boolean',
        boolean: true,
        describe: 'Exclude delivery keys when importing content items.'
    })
        .option('logFile', {
        type: 'string',
        default: exports.LOG_FILENAME,
        describe: 'Path to a log file to write to.'
    });
};
function rimraf(dir) {
    return new Promise((resolve) => {
        rimraf_1.default(dir, resolve);
    });
}
exports.handler = async (argv) => {
    const logFile = argv.logFile;
    const log = typeof logFile === 'string' || logFile == null ? new file_log_1.FileLog(logFile) : logFile;
    const tempFolder = getTempFolder(Date.now().toString());
    const yargArgs = {
        $0: '',
        _: [],
        json: true
    };
    let result = false;
    const copyConfig = typeof argv.copyConfig !== 'object' ? await copy_config_1.loadCopyConfig(argv, log) : argv.copyConfig;
    if (copyConfig == null) {
        return false;
    }
    const { srcHubId, srcClientId, srcSecret, dstHubId, dstClientId, dstSecret } = copyConfig;
    if (argv.revertLog) {
        result = await import_revert_1.revert({
            ...yargArgs,
            hubId: dstHubId,
            clientId: dstClientId,
            clientSecret: dstSecret,
            dir: tempFolder,
            revertLog: argv.revertLog
        });
    }
    else {
        await directory_utils_1.ensureDirectoryExists(tempFolder);
        try {
            log.appendLine('=== Exporting from source... ===');
            await export_1.handler({
                ...yargArgs,
                hubId: srcHubId,
                clientId: srcClientId,
                clientSecret: srcSecret,
                folderId: argv.srcFolder,
                repoId: argv.srcRepo,
                schemaId: argv.schemaId,
                name: argv.name,
                logFile: log,
                dir: tempFolder,
                exportedIds: argv.exportedIds,
                publish: argv.lastPublish
            });
            log.appendLine('=== Importing to destination... ===');
            const importResult = await import_1.handler({
                ...yargArgs,
                hubId: dstHubId,
                clientId: dstClientId,
                clientSecret: dstSecret,
                dir: tempFolder,
                baseRepo: argv.dstRepo,
                baseFolder: argv.dstFolder,
                mapFile: argv.mapFile,
                force: argv.force,
                validate: argv.validate,
                skipIncomplete: argv.skipIncomplete,
                logFile: log,
                republish: argv.republish,
                publish: argv.publish,
                excludeKeys: argv.excludeKeys
            });
            if (importResult) {
                log.appendLine('=== Done! ===');
                result = true;
            }
        }
        catch (e) {
            log.appendLine('An unexpected error occurred: \n' + e.toString());
        }
        await rimraf(tempFolder);
    }
    if (typeof logFile !== 'object') {
        await log.close();
    }
    return result;
};

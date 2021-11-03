"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const log_helpers_1 = require("../../common/log-helpers");
const copy = __importStar(require("./copy"));
const file_log_1 = require("../../common/file-log");
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const copy_config_1 = require("../../common/content-item/copy-config");
const import_revert_1 = require("./import-revert");
exports.command = 'move';
exports.desc = 'Move content items. The active account and hub are the source for the move.';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('item', 'move', platform);
exports.builder = (yargs) => {
    yargs
        .option('revertLog', {
        type: 'string',
        describe: 'Path to a log file to revert a move for. This will archive the most recently moved resources from the destination, unarchive from the source, and revert updated ones.'
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
exports.handler = async (argv) => {
    argv.exportedIds = [];
    if (argv.revertLog != null) {
        const copyConfig = await copy_config_1.loadCopyConfig(argv, new file_log_1.FileLog());
        if (copyConfig == null) {
            return;
        }
        const client = dynamic_content_client_factory_1.default({
            ...argv,
            hubId: copyConfig.srcHubId,
            clientId: copyConfig.srcClientId,
            clientSecret: copyConfig.srcSecret
        });
        const log = new file_log_1.FileLog();
        try {
            await log.loadFromFile(argv.revertLog);
        }
        catch (e) {
            console.log('Could not open the import log! Aborting.');
            return;
        }
        const toUnarchive = log.getData('MOVED');
        for (let i = 0; i < toUnarchive.length; i++) {
            const id = toUnarchive[i];
            let item;
            try {
                item = await client.contentItems.get(id);
            }
            catch (_a) {
                console.log(`Could not find item with id ${id}, skipping.`);
                continue;
            }
            if (item.status !== dc_management_sdk_js_1.Status.ACTIVE) {
                try {
                    await item.related.unarchive();
                }
                catch (_b) {
                    console.log(`Could not unarchive item with id ${id}, skipping.`);
                    continue;
                }
            }
            else {
                console.log(`Item with id ${id} is already unarchived, skipping.`);
            }
        }
        const yargArgs = {
            $0: '',
            _: [],
            json: true
        };
        await import_revert_1.revert({
            ...yargArgs,
            hubId: copyConfig.dstHubId,
            clientId: copyConfig.dstClientId,
            clientSecret: copyConfig.dstSecret,
            dir: '',
            revertLog: argv.revertLog
        });
    }
    else {
        const log = new file_log_1.FileLog(argv.logFile);
        argv.logFile = log;
        const copyConfig = await copy_config_1.loadCopyConfig(argv, log);
        if (copyConfig == null) {
            return;
        }
        argv.copyConfig = copyConfig;
        const copySuccess = await copy.handler(argv);
        if (!copySuccess) {
            return;
        }
        const client = dynamic_content_client_factory_1.default({
            ...argv,
            hubId: copyConfig.srcHubId,
            clientId: copyConfig.srcClientId,
            clientSecret: copyConfig.srcSecret
        });
        const exported = argv.exportedIds;
        for (let i = 0; i < exported.length; i++) {
            const item = await client.contentItems.get(exported[i]);
            try {
                await item.related.archive();
                log.addAction('MOVED', item.id);
            }
            catch (e) {
                log.addComment(`ARCHIVE FAILED: ${item.id}`);
                log.addComment(e.toString());
            }
        }
        log.close();
    }
};

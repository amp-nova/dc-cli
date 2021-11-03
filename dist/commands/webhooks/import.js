"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const file_log_1 = require("../../common/file-log");
const log_helpers_1 = require("../../common/log-helpers");
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const fs_1 = require("fs");
const util_1 = require("util");
exports.command = 'import <filePath>';
exports.desc = 'Import Webhooks';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('webhooks', 'import', platform);
exports.builder = (yargs) => {
    yargs
        .positional('filePath', {
        describe: 'Source file path containing Webhooks definition',
        type: 'string'
    })
        .option('logFile', {
        type: 'string',
        default: exports.LOG_FILENAME,
        describe: 'Path to a log file to write to.'
    })
        .alias('f', 'force')
        .option('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite webhooks without asking.'
    });
};
exports.handler = async (argv) => {
    const { filePath: sourceFile, logFile, force, answer = true } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const publishedWebhooksObject = await hub.related.webhooks.list();
    const publishedWebhooks = publishedWebhooksObject.getItems();
    const log = typeof logFile === 'string' || logFile == null ? new file_log_1.FileLog(logFile) : logFile;
    try {
        const exportedWebhooks = await util_1.promisify(fs_1.readFile)(sourceFile, { encoding: 'utf8' });
        let importWebhooks = JSON.parse(exportedWebhooks);
        const publishedWebhooksIDs = publishedWebhooks.map((x) => x.id);
        const importWebhooksIDs = importWebhooks.map((x) => x.id);
        const alreadyExists = publishedWebhooksIDs.filter(x => importWebhooksIDs.includes(x));
        if (alreadyExists.length > 0) {
            const question = !force
                ? await archive_helpers_1.asyncQuestion(`${alreadyExists.length}/${importWebhooksIDs.length} of the webhooks being imported already exist in the hub. Would you like to re-create these webhooks instead of skipping them? (y/n) `)
                : answer;
            const updateExisting = question || force;
            if (!updateExisting) {
                importWebhooks = importWebhooks.filter((item) => !publishedWebhooksIDs.includes(item.id));
            }
        }
        await Promise.all(importWebhooks.map(async (item) => {
            const exists = publishedWebhooksIDs.includes(item.id) ? item.id : undefined;
            if (exists) {
                const hub = await client.hubs.get(argv.hubId);
                const webhook = await hub.related.webhooks.get(exists);
                await webhook.related.delete();
                log.addAction('DELETE', exists);
            }
            item.id = undefined;
            item.secret = undefined;
            const newItem = await hub.related.webhooks.create(new dc_management_sdk_js_1.Webhook(item));
            log.addAction('CREATE', newItem.id || '');
        }));
        log.appendLine('Done!');
        if (log) {
            await log.close();
        }
        process.stdout.write('\n');
    }
    catch (e) {
        console.log(e);
    }
};

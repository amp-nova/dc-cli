"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const file_log_1 = require("../../common/file-log");
const log_helpers_1 = require("../../common/log-helpers");
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const fs_1 = require("fs");
const util_1 = require("util");
const fetch_client_service_class_1 = require("../../services/fetch-client-service-class");
exports.command = 'import <filePath>';
exports.desc = 'Import Extensions';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('extensions', 'import', platform);
exports.builder = (yargs) => {
    yargs
        .positional('filePath', {
        describe: 'Source file path containing Extensions definition',
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
        describe: 'Overwrite extensions without asking.'
    });
};
exports.handler = async (argv) => {
    const { filePath: sourceFile, logFile, force, answer = true } = argv;
    const fetchClient = new fetch_client_service_class_1.FetchClientService();
    await fetchClient.init(argv);
    const publishedExtensions = await fetchClient.getExtensionsList();
    const log = typeof logFile === 'string' || logFile == null ? new file_log_1.FileLog(logFile) : logFile;
    try {
        const exportedExtensions = await util_1.promisify(fs_1.readFile)(sourceFile, { encoding: 'utf8' });
        let importExtensions = JSON.parse(exportedExtensions);
        const publishedExtensionsIDs = publishedExtensions.map((x) => x.id);
        const importExtensionsIDs = importExtensions.map((x) => x.id);
        const alreadyExists = publishedExtensionsIDs.filter((x) => importExtensionsIDs.includes(x));
        if (alreadyExists.length > 0) {
            const question = !force
                ? await archive_helpers_1.asyncQuestion(`${alreadyExists.length}/${importExtensionsIDs.length} of the extensions being imported already exist in the hub. Would you like to update these extensions instead of skipping them? (y/n) `)
                : answer;
            const updateExisting = question || force;
            if (!updateExisting) {
                importExtensions = importExtensions.filter((item) => !publishedExtensionsIDs.includes(item.id));
            }
        }
        await Promise.all(importExtensions.map(async (item) => {
            let exists = publishedExtensionsIDs.includes(item.id) ? item.id : undefined;
            if (!exists) {
                console.log(`Checking existence by extension name: ${item.name}`);
                const extension = await fetchClient.getExtensionByName(item.name);
                if (extension)
                    exists = extension.id;
            }
            if (exists) {
                delete item.hubId;
                delete item.secret;
                const updatedExtensionId = await fetchClient.updateExtension(exists, item);
                log.addAction('UDPATE', updatedExtensionId || '');
            }
            else {
                delete item.id;
                delete item.hubId;
                delete item.secret;
                const createdExtensionId = await fetchClient.createExtension(item);
                log.addAction('CREATE', createdExtensionId || '');
            }
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

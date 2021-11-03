"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const file_log_1 = require("../../common/file-log");
const log_helpers_1 = require("../../common/log-helpers");
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const fs_1 = require("fs");
const util_1 = require("util");
const fetch_client_service_class_1 = require("../../services/fetch-client-service-class");
exports.command = 'import <filePath>';
exports.desc = 'Import Indexes';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('indexes', 'import', platform);
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.builder = (yargs) => {
    yargs
        .positional('filePath', {
        describe: 'Source file path containing Indexes definition',
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
        describe: 'Overwrite indexes without asking.'
    });
};
exports.handler = async (argv) => {
    const { filePath: sourceFile, logFile, force, answer = true } = argv;
    const fetchClient = new fetch_client_service_class_1.FetchClientService();
    await fetchClient.init(argv);
    const publishedIndexes = await fetchClient.getIndexesList();
    const log = typeof logFile === 'string' || logFile == null ? new file_log_1.FileLog(logFile) : logFile;
    try {
        const exportedIndexes = await util_1.promisify(fs_1.readFile)(sourceFile, { encoding: 'utf8' });
        let importIndexes = JSON.parse(exportedIndexes);
        const publishedIndexesIDs = publishedIndexes.map((x) => x.id);
        const importIndexesIDs = importIndexes.map((x) => x.id);
        const alreadyExists = publishedIndexesIDs.filter((x) => importIndexesIDs.includes(x));
        if (alreadyExists.length > 0) {
            const question = !force
                ? await archive_helpers_1.asyncQuestion(`${alreadyExists.length}/${importIndexesIDs.length} of the indexes being imported already exist in the hub. Would you like to re-create these indexes instead of skipping them? (y/n) `)
                : answer;
            const updateExisting = question || force;
            if (!updateExisting) {
                importIndexes = importIndexes.filter((item) => !publishedIndexesIDs.includes(item.id));
            }
        }
        await Promise.all(importIndexes.map(async (item) => {
            const exists = publishedIndexesIDs.includes(item.id) ? item.id : undefined;
            if (exists) {
                console.log(`Deleting index and replicas: ${exists}`);
                const deletedIndexIds = await fetchClient.deleteIndexAndReplicas(exists);
                console.log(`...Index and replicas deleted for IDs: ${deletedIndexIds}`);
                console.log();
                log.addAction('DELETE INDEX', deletedIndexIds.join(','));
            }
            delete item.indexDetails.id;
            delete item.indexDetails.replicaCount;
            console.log(`Creating index for index name: ${item.indexDetails.name}`);
            const createdIndexId = await fetchClient.createIndex(item.indexDetails);
            console.log(`...Index created with ID: ${createdIndexId}`);
            log.addAction('CREATE INDEX', createdIndexId || '');
            console.log(`\nUpdating index settings for ID: ${createdIndexId}`);
            const updatedIndexId = await fetchClient.updateIndexSettings(createdIndexId, item.settings);
            console.log(`...Index settings updated for ID: ${updatedIndexId}`);
            log.addAction('UPDATE INDEX SETTINGS', updatedIndexId || '');
            await sleep(3000);
            const replicasSettings = item.replicasSettings;
            console.log(`\nGetting replica index details from names: ${replicasSettings.map((x) => x.name).join(',')}`);
            const replicasIndexes = await Promise.all(replicasSettings.map((item) => fetchClient.getIndexByName(item.name)));
            console.log(`...Retrieved replica index details for IDs: ${replicasIndexes.map((x) => x.id).join(',')}`);
            console.log(`\nUpdating replicas settings for IDs: ${replicasIndexes.map((x) => x.id).join(',')}`);
            const updatedReplicasSettingsIds = await Promise.all(replicasIndexes.map((item, i) => fetchClient.updateIndexSettings(item.id, replicasSettings[i].settings)));
            console.log(`...Updated replicas settings for IDs: ${updatedReplicasSettingsIds.join(',')}`);
            console.log();
            log.addAction('UPDATE INDEX SETTINGS', updatedReplicasSettingsIds.join(',') || '');
            const types = await fetchClient.getIndexAssignedContentTypes(createdIndexId);
            if (types.length > 0) {
                const type = types[0];
                const activeContentWebhookId = type._links['active-content-webhook'].href.split('/').slice(-1)[0];
                const archivedContentWebhookId = type._links['archived-content-webhook'].href.split('/').slice(-1)[0];
                console.log(`Updating webhooks ${activeContentWebhookId}, ${archivedContentWebhookId}`);
                await Promise.all([
                    fetchClient.updateWebhook(activeContentWebhookId, {
                        customPayload: {
                            type: 'text/x-handlebars-template',
                            value: item.activeContentWebhook
                        }
                    }),
                    fetchClient.updateWebhook(archivedContentWebhookId, {
                        customPayload: {
                            type: 'text/x-handlebars-template',
                            value: item.archivedContentWebhook
                        }
                    })
                ]);
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

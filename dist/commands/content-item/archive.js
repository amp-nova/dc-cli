"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const archive_log_1 = require("../../common/archive/archive-log");
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const filter_1 = require("../../common/filter/filter");
const log_helpers_1 = require("../../common/log-helpers");
exports.command = 'archive [id]';
exports.desc = 'Archive Content Items';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('content-item', 'archive', platform);
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        type: 'string',
        describe: 'The ID of a content item to be archived. If id is not provided, this command will archive ALL content items through all content repositories in the hub.'
    })
        .option('repoId', {
        type: 'string',
        describe: 'The ID of a content repository to search items in to be archived.',
        requiresArg: false
    })
        .option('folderId', {
        type: 'string',
        describe: 'The ID of a folder to search items in to be archived.',
        requiresArg: false
    })
        .option('name', {
        type: 'string',
        describe: 'The name of a Content Item to be archived.\nA regex can be provided to select multiple items with similar or matching names (eg /.header/).\nA single --name option may be given to match a single content item pattern.\nMultiple --name options may be given to match multiple content items patterns at the same time, or even multiple regex.'
    })
        .option('contentType', {
        type: 'string',
        describe: 'A pattern which will only archive content items with a matching Content Type Schema ID. A single --contentType option may be given to match a single schema id pattern.\\nMultiple --contentType options may be given to match multiple schema patterns at the same time.'
    })
        .option('revertLog', {
        type: 'string',
        describe: 'Path to a log file containing content items unarchived in a previous run of the unarchive command.\nWhen provided, archives all content items listed as UNARCHIVE in the log file.',
        requiresArg: false
    })
        .alias('f', 'force')
        .option('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before archiving the found content.'
    })
        .alias('s', 'silent')
        .option('s', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, no log file will be produced.'
    })
        .option('ignoreError', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, archive requests that fail will not abort the process.'
    })
        .option('logFile', {
        type: 'string',
        default: exports.LOG_FILENAME,
        describe: 'Path to a log file to write to.'
    });
};
exports.filterContentItems = async ({ revertLog, name, contentType, contentItems }) => {
    try {
        let missingContent = false;
        if (revertLog != null) {
            const log = await new archive_log_1.ArchiveLog().loadFromFile(revertLog);
            const ids = log.getData('UNARCHIVE');
            const contentItemsFiltered = contentItems.filter(contentItem => ids.indexOf(contentItem.id || '') != -1);
            if (contentItems.length != ids.length) {
                missingContent = true;
            }
            return {
                contentItems: contentItemsFiltered,
                missingContent
            };
        }
        if (name != null) {
            const itemsArray = Array.isArray(name) ? name : [name];
            const contentItemsFiltered = contentItems.filter(item => itemsArray.findIndex(id => filter_1.equalsOrRegex(item.label || '', id)) != -1);
            return {
                contentItems: contentItemsFiltered,
                missingContent
            };
        }
        if (contentType != null) {
            const itemsArray = Array.isArray(contentType) ? contentType : [contentType];
            const contentItemsFiltered = contentItems.filter(item => {
                return itemsArray.findIndex(id => filter_1.equalsOrRegex(item.body._meta.schema, id)) != -1;
            });
            return {
                contentItems: contentItemsFiltered,
                missingContent
            };
        }
        return {
            contentItems,
            missingContent
        };
    }
    catch (err) {
        console.log(err);
        return {
            contentItems: [],
            missingContent: false
        };
    }
};
exports.getContentItems = async ({ client, id, hubId, repoId, folderId, revertLog, name, contentType }) => {
    try {
        const contentItems = [];
        if (id != null) {
            contentItems.push(await client.contentItems.get(id));
            return {
                contentItems,
                missingContent: false
            };
        }
        const hub = await client.hubs.get(hubId);
        const repoIds = typeof repoId === 'string' ? [repoId] : repoId || [];
        const folderIds = typeof folderId === 'string' ? [folderId] : folderId || [];
        const contentRepositories = await (repoId != null
            ? Promise.all(repoIds.map(id => client.contentRepositories.get(id)))
            : paginator_1.default(hub.related.contentRepositories.list));
        const folders = folderId != null ? await Promise.all(folderIds.map(id => client.folders.get(id))) : [];
        folderId != null
            ? await Promise.all(folders.map(async (source) => {
                const items = await paginator_1.default(source.related.contentItems.list);
                contentItems.push(...items.filter(item => item.status == 'ACTIVE'));
            }))
            : await Promise.all(contentRepositories.map(async (source) => {
                const items = await paginator_1.default(source.related.contentItems.list, { status: 'ACTIVE' });
                contentItems.push(...items);
            }));
        return ((await exports.filterContentItems({
            revertLog,
            name,
            contentType,
            contentItems
        })) || {
            contentItems: [],
            missingContent: false
        });
    }
    catch (err) {
        console.log(err);
        return {
            contentItems: [],
            missingContent: false
        };
    }
};
exports.processItems = async ({ contentItems, force, silent, logFile, allContent, missingContent, ignoreError }) => {
    if (contentItems.length == 0) {
        console.log('Nothing found to archive, aborting.');
        return;
    }
    console.log('The following content items will be archived:');
    contentItems.forEach((contentItem) => {
        console.log(` ${contentItem.label} (${contentItem.id})`);
    });
    console.log(`Total: ${contentItems.length}`);
    if (!force) {
        const yes = await archive_helpers_1.confirmArchive('archive', 'content item', allContent, missingContent);
        if (!yes) {
            return;
        }
    }
    const timestamp = Date.now().toString();
    const log = new archive_log_1.ArchiveLog(`Content Items Archive Log - ${timestamp}\n`);
    let successCount = 0;
    for (let i = 0; i < contentItems.length; i++) {
        try {
            await contentItems[i].related.archive();
            log.addAction('ARCHIVE', `${contentItems[i].id}\n`);
            successCount++;
        }
        catch (e) {
            log.addComment(`ARCHIVE FAILED: ${contentItems[i].id}`);
            log.addComment(e.toString());
            if (ignoreError) {
                console.log(`Failed to archive ${contentItems[i].label} (${contentItems[i].id}), continuing. Error: \n${e.toString()}`);
            }
            else {
                console.log(`Failed to archive ${contentItems[i].label} (${contentItems[i].id}), aborting. Error: \n${e.toString()}`);
                break;
            }
        }
    }
    if (!silent && logFile) {
        await log.writeToFile(logFile.replace('<DATE>', timestamp));
    }
    console.log(`Archived ${successCount} content items.`);
};
exports.handler = async (argv) => {
    const { id, logFile, force, silent, ignoreError, hubId, revertLog, repoId, folderId, name, contentType } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    const allContent = !id && !name && !contentType && !revertLog;
    if (repoId && id) {
        console.log('ID of content item is specified, ignoring repository ID');
    }
    if (id && name) {
        console.log('Please specify either a item name or an ID - not both.');
        return;
    }
    if (repoId && folderId) {
        console.log('Folder is specified, ignoring repository ID');
    }
    if (allContent) {
        console.log('No filter was given, archiving all content');
    }
    const { contentItems, missingContent } = await exports.getContentItems({
        client,
        id,
        hubId,
        repoId,
        folderId,
        revertLog,
        contentType,
        name
    });
    await exports.processItems({
        contentItems,
        force,
        silent,
        logFile,
        allContent,
        missingContent,
        ignoreError
    });
};

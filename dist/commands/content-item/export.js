"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const file_log_1 = require("../../common/file-log");
const path_1 = require("path");
const filter_1 = require("../../common/filter/filter");
const sanitize_filename_1 = __importDefault(require("sanitize-filename"));
const export_service_1 = require("../../services/export.service");
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const directory_utils_1 = require("../../common/import/directory-utils");
const content_dependancy_tree_1 = require("../../common/content-item/content-dependancy-tree");
const content_mapping_1 = require("../../common/content-item/content-mapping");
const log_helpers_1 = require("../../common/log-helpers");
const amplience_schema_validator_1 = require("../../common/content-item/amplience-schema-validator");
exports.command = 'export <dir>';
exports.desc = 'Export Content Items';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('item', 'export', platform);
exports.builder = (yargs) => {
    yargs
        .positional('dir', {
        describe: 'Output directory for the exported Content Items',
        type: 'string',
        requiresArg: true
    })
        .option('repoId', {
        type: 'string',
        describe: 'Export content from within a given repository. Directory structure will start at the specified repository. Will automatically export all contained folders.'
    })
        .option('folderId', {
        type: 'string',
        describe: 'Export content from within a given folder. Directory structure will start at the specified folder. Can be used in addition to repoId.'
    })
        .option('schemaId', {
        type: 'string',
        describe: 'Export content with a given or matching Schema ID. A regex can be provided, surrounded with forward slashes. Can be used in combination with other filters.'
    })
        .option('name', {
        type: 'string',
        describe: 'Export content with a given or matching Name. A regex can be provided, surrounded with forward slashes. Can be used in combination with other filters.'
    })
        .option('publish', {
        type: 'boolean',
        boolean: true,
        describe: 'When available, export the last published version of a content item rather than its newest version.'
    })
        .option('logFile', {
        type: 'string',
        default: exports.LOG_FILENAME,
        describe: 'Path to a log file to write to.'
    });
};
const getOrAddFolderPath = async (folderToPathMap, client, folder, log) => {
    const id = folder.id;
    const mapResult = folderToPathMap.get(id);
    if (mapResult !== undefined) {
        return mapResult;
    }
    const name = sanitize_filename_1.default(folder.name);
    let path;
    try {
        const parent = await folder.related.folders.parent();
        path = `${path_1.join(await getOrAddFolderPath(folderToPathMap, client, parent, log), name)}`;
    }
    catch (_a) {
        log.appendLine(`Could not determine path for ${folder.name}. Placing in base directory.`);
        path = `${name}`;
    }
    folderToPathMap.set(id, path);
    return path;
};
const getContentItems = async (folderToPathMap, client, hub, dir, log, repoId, folderId, publish) => {
    const items = [];
    const folderIds = typeof folderId === 'string' ? [folderId] : folderId || [];
    const repoItems = [];
    const repoIds = typeof repoId === 'string' ? [repoId] : repoId || [];
    const repositories = await (repoId != null || folderId != null
        ? Promise.all(repoIds.map(id => client.contentRepositories.get(id)))
        : paginator_1.default(hub.related.contentRepositories.list));
    let specifyBasePaths = repositories.length + folderIds.length > 1;
    for (let i = 0; i < repositories.length; i++) {
        const repository = repositories[i];
        const baseDir = specifyBasePaths ? `${sanitize_filename_1.default(repository.label)}/` : '';
        await directory_utils_1.ensureDirectoryExists(path_1.join(dir, baseDir));
        const newFolders = await paginator_1.default(repository.related.folders.list);
        newFolders.forEach(folder => {
            if (folderIds.indexOf(folder.id) === -1) {
                folderIds.push(folder.id);
            }
            folderToPathMap.set(folder.id, path_1.join(baseDir, `${sanitize_filename_1.default(folder.name)}/`));
        });
        let newItems;
        try {
            const allItems = await paginator_1.default(repository.related.contentItems.list, { status: 'ACTIVE' });
            Array.prototype.push.apply(repoItems, allItems);
            newItems = allItems.filter(item => item.folderId == null);
        }
        catch (e) {
            console.error(`Error getting items from repository ${repository.name} (${repository.id}): ${e.toString()}`);
            continue;
        }
        Array.prototype.push.apply(items, newItems.map(item => ({ item, path: baseDir })));
    }
    const parallelism = 10;
    const folders = await Promise.all(folderIds.map(id => client.folders.get(id)));
    log.appendLine(`Found ${folders.length} base folders.`);
    specifyBasePaths = specifyBasePaths || folders.length > 1;
    const nextFolders = [];
    let processFolders = folders;
    let baseFolder = true;
    while (processFolders.length > 0) {
        const promises = processFolders.map(async (folder) => {
            if (baseFolder) {
                if (!folderToPathMap.has(folder.id)) {
                    folderToPathMap.set(folder.id, specifyBasePaths ? `${sanitize_filename_1.default(folder.name)}/` : '');
                }
            }
            const path = await getOrAddFolderPath(folderToPathMap, client, folder, log);
            log.appendLine(`Processing ${path}...`);
            let newItems;
            newItems = repoItems.filter(item => item.folderId == folder.id);
            if (newItems.length == 0) {
                log.appendLine(`Fetching additional folder: ${folder.name}`);
                try {
                    newItems = (await paginator_1.default(folder.related.contentItems.list)).filter(item => item.status === 'ACTIVE');
                }
                catch (e) {
                    console.error(`Error getting items from folder ${folder.name} (${folder.id}): ${e.toString()}`);
                    return;
                }
            }
            Array.prototype.push.apply(items, newItems.map(item => ({ item, path: path })));
            try {
                const subfolders = await paginator_1.default(folder.related.folders.list);
                Array.prototype.push.apply(nextFolders, subfolders);
            }
            catch (e) {
                console.error(`Error getting subfolders from folder ${folder.name} (${folder.id}): ${e.toString()}`);
            }
        });
        await Promise.all(promises);
        baseFolder = false;
        processFolders = nextFolders.splice(0, Math.min(nextFolders.length, parallelism));
    }
    if (publish) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const publishedVersion = item.item.lastPublishedVersion;
            if (publishedVersion != null && publishedVersion != item.item.version) {
                const newVersion = await item.item.related.contentItemVersion(publishedVersion);
                item.item = newVersion;
            }
        }
    }
    return items;
};
exports.handler = async (argv) => {
    const { dir, repoId, folderId, schemaId, name, logFile, publish } = argv;
    const dummyRepo = new dc_management_sdk_js_1.ContentRepository();
    const folderToPathMap = new Map();
    const client = dynamic_content_client_factory_1.default(argv);
    const log = typeof logFile === 'string' || logFile == null ? new file_log_1.FileLog(logFile) : logFile;
    const hub = await client.hubs.get(argv.hubId);
    log.appendLine('Retrieving content items, please wait.');
    let items = await getContentItems(folderToPathMap, client, hub, dir, log, repoId, folderId, publish);
    if (schemaId != null) {
        const schemaIds = Array.isArray(schemaId) ? schemaId : [schemaId];
        items = items.filter(({ item }) => schemaIds.findIndex(id => filter_1.equalsOrRegex(item.body._meta.schema, id)) !== -1);
    }
    if (name != null) {
        const names = Array.isArray(name) ? name : [name];
        items = items.filter(({ item }) => names.findIndex(name => filter_1.equalsOrRegex(item.label, name)) !== -1);
    }
    log.appendLine('Scanning for dependancies.');
    const repoItems = items.map(item => ({ repo: dummyRepo, content: item.item }));
    const missingIDs = new Set();
    let newMissingIDs;
    do {
        const tree = new content_dependancy_tree_1.ContentDependancyTree(repoItems, new content_mapping_1.ContentMapping());
        newMissingIDs = new Set();
        tree.filterAny(item => {
            const missingDeps = item.dependancies.filter(dep => !tree.byId.has(dep.dependancy.id));
            missingDeps.forEach(dep => {
                const id = dep.dependancy.id;
                if (!missingIDs.has(id)) {
                    newMissingIDs.add(id);
                }
                missingIDs.add(id);
            });
            return missingDeps.length > 0;
        });
        const newIdArray = Array.from(newMissingIDs);
        for (let i = 0; i < newIdArray.length; i++) {
            try {
                const item = await client.contentItems.get(newIdArray[i]);
                repoItems.push({ repo: await item.related.contentRepository(), content: item });
            }
            catch (_a) { }
        }
    } while (newMissingIDs.size > 0);
    if (missingIDs.size > 0) {
        const missingIdArray = Array.from(missingIDs);
        const allRepo = repoId == null && folderId == null;
        for (let i = 0; i < missingIdArray.length; i++) {
            const repoItem = repoItems.find(ri => ri.content.id == missingIdArray[i]);
            if (repoItem != null) {
                const item = repoItem.content;
                let path = '_dependancies/';
                if (allRepo) {
                    const repo = repoItem.repo;
                    path = path_1.join(sanitize_filename_1.default(repo.label), path);
                }
                items.push({ item, path });
                log.appendLine(item.status === 'ACTIVE'
                    ? `Referenced content '${item.label}' added to the export.`
                    : `Referenced content '${item.label}' is archived, but is needed as a dependancy. It has been added to the export.`);
            }
            else {
                log.appendLine(`Referenced content ${missingIdArray[i]} does not exist.`);
            }
        }
    }
    log.appendLine('Saving content items.');
    const filenames = [];
    const schemas = await paginator_1.default(hub.related.contentTypeSchema.list);
    const types = await paginator_1.default(hub.related.contentTypes.list);
    const validator = new amplience_schema_validator_1.AmplienceSchemaValidator(amplience_schema_validator_1.defaultSchemaLookup(types, schemas));
    for (let i = 0; i < items.length; i++) {
        const { item, path } = items[i];
        try {
            const errors = await validator.validate(item.body);
            if (errors.length > 0) {
                log.appendLine(`WARNING: ${item.label} does not validate under the available schema. It may not import correctly.`);
                log.appendLine(JSON.stringify(errors, null, 2));
            }
        }
        catch (e) {
            log.appendLine(`WARNING: Could not validate ${item.label} as there is a problem with the schema: ${e}`);
        }
        let resolvedPath;
        resolvedPath = path;
        const directory = path_1.join(dir, resolvedPath);
        resolvedPath = export_service_1.uniqueFilenamePath(directory, `${sanitize_filename_1.default(item.label)}`, 'json', filenames);
        filenames.push(resolvedPath);
        log.appendLine(resolvedPath);
        await directory_utils_1.ensureDirectoryExists(directory);
        if (argv.exportedIds) {
            argv.exportedIds.push(item.id);
        }
        export_service_1.writeJsonToFile(resolvedPath, item);
    }
    if (typeof logFile !== 'object') {
        await log.close();
    }
};

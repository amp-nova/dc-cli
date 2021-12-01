"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const import_revert_1 = require("./import-revert");
const file_log_1 = require("../../common/file-log");
const path_1 = require("path");
const fs_1 = require("fs");
const util_1 = require("util");
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const content_mapping_1 = require("../../common/content-item/content-mapping");
const content_dependancy_tree_1 = require("../../common/content-item/content-dependancy-tree");
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const amplience_schema_validator_1 = require("../../common/content-item/amplience-schema-validator");
const log_helpers_1 = require("../../common/log-helpers");
const publish_queue_1 = require("../../common/import/publish-queue");
function getDefaultMappingPath(name, platform = process.platform) {
    return path_1.join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', `imports/`, `${name}.json`);
}
exports.getDefaultMappingPath = getDefaultMappingPath;
exports.command = 'import <dir>';
exports.desc = 'Import content items';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('item', 'import', platform);
exports.builder = (yargs) => {
    yargs
        .positional('dir', {
        describe: 'Directory containing content items to import. If this points to an export manifest, we will try and import the content with the same absolute path and repositories as the export.',
        type: 'string',
        requiresArg: true
    })
        .option('baseRepo', {
        type: 'string',
        describe: 'Import matching the given repository to the import base directory, by ID. Folder structure will be followed and replicated from there.'
    })
        .option('baseFolder', {
        type: 'string',
        describe: 'Import matching the given folder to the import base directory, by ID. Folder structure will be followed and replicated from there.'
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
        describe: 'Skip any content items that has one or more missing dependancy.'
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
const getSubfolders = (context, folder) => {
    if (context.folderToSubfolderMap.has(folder.id)) {
        return context.folderToSubfolderMap.get(folder.id);
    }
    const subfolders = paginator_1.default(folder.related.folders.list);
    context.folderToSubfolderMap.set(folder.id, subfolders);
    return subfolders;
};
let getOrCreateFolderCached;
const getOrCreateFolder = async (context, rel) => {
    try {
        const parentPath = path_1.dirname(rel);
        const parent = await getOrCreateFolderCached(context, path_1.resolve(context.baseDir, parentPath));
        const folderInfo = {
            name: path_1.basename(rel)
        };
        const container = parent == null ? context.rootFolders : await getSubfolders(context, parent);
        let result = container.find(target => target.name === folderInfo.name);
        const containerName = parent == null ? context.repo.label : parent.name;
        if (result == null) {
            if (parent == null) {
                result = await context.repo.related.folders.create(new dc_management_sdk_js_1.Folder(folderInfo));
            }
            else {
                result = await parent.related.folders.create(new dc_management_sdk_js_1.Folder(folderInfo));
            }
            context.log.appendLine(`Created folder in ${containerName}: '${rel}'.`);
        }
        else {
            context.log.appendLine(`Found existing subfolder in ${containerName}: '${rel}'.`);
        }
        return result;
    }
    catch (e) {
        context.log.appendLine(`Couldn't get or create folder ${rel}! ${e.toString()}`);
        throw e;
    }
};
getOrCreateFolderCached = async (context, path) => {
    let rel = path_1.relative(context.baseDir, path);
    if (rel === '') {
        rel = '.';
    }
    if (context.pathToFolderMap.has(rel)) {
        return await context.pathToFolderMap.get(rel);
    }
    const resultPromise = getOrCreateFolder(context, rel);
    context.pathToFolderMap.set(rel, resultPromise);
    const result = await resultPromise;
    return result;
};
const traverseRecursive = async (path, action) => {
    const dir = await util_1.promisify(fs_1.readdir)(path);
    await Promise.all(dir.map(async (contained) => {
        contained = path_1.join(path, contained);
        const stat = await util_1.promisify(fs_1.lstat)(contained);
        return await (stat.isDirectory() ? traverseRecursive(contained, action) : action(contained));
    }));
};
const createOrUpdateContent = async (client, repo, existing, item) => {
    let oldItem = null;
    if (typeof existing === 'string') {
        oldItem = await client.contentItems.get(existing);
    }
    else {
        oldItem = existing;
    }
    let result;
    if (oldItem == null) {
        result = { newItem: await repo.related.contentItems.create(item), oldVersion: 0 };
    }
    else {
        const oldVersion = oldItem.version || 0;
        item.version = oldItem.version;
        if (oldItem.status !== dc_management_sdk_js_1.Status.ACTIVE) {
            oldItem = await oldItem.related.unarchive();
        }
        result = { newItem: await oldItem.related.update(item), oldVersion };
    }
    if (item.locale != null && result.newItem.locale != item.locale) {
        await result.newItem.related.setLocale(item.locale);
    }
    return result;
};
const itemShouldPublish = (item) => {
    return item.publish;
};
const trySaveMapping = async (mapFile, mapping, log) => {
    if (mapFile != null) {
        try {
            await mapping.save(mapFile);
        }
        catch (e) {
            log.appendLine(`Failed to save the mapping. ${e.toString()}`);
        }
    }
};
const prepareContentForImport = async (client, hub, repos, folder, mapping, log, argv) => {
    const { force, skipIncomplete } = argv;
    const contexts = new Map();
    repos.forEach(repo => {
        const pathToFolderMap = new Map();
        if (folder != null) {
            pathToFolderMap.set('.', Promise.resolve(folder));
        }
        else {
            pathToFolderMap.set('.', Promise.resolve(null));
        }
        contexts.set(repo.repo, {
            client,
            hub,
            repo: repo.repo,
            pathToFolderMap,
            baseDir: path_1.resolve(repo.basePath),
            folderToSubfolderMap: new Map(),
            mapping,
            rootFolders: [],
            log
        });
    });
    let contentItems = [];
    const schemaNames = new Set();
    for (let i = 0; i < repos.length; i++) {
        const repo = repos[i].repo;
        const context = contexts.get(repo);
        try {
            const folders = await paginator_1.default(repo.related.folders.list);
            for (let j = 0; j < folders.length; j++) {
                const folder = folders[j];
                let parent = null;
                try {
                    parent = await folder.related.folders.parent();
                }
                catch (_a) {
                }
                if (parent == null) {
                    context.rootFolders.push(folder);
                }
            }
        }
        catch (e) {
            log.appendLine(`Could not get base folders for repository ${repo.label}: ${e.toString()}`);
            return null;
        }
        log.appendLine(`Scanning structure and content in '${repos[i].basePath}' for repository '${repo.label}'...`);
        await traverseRecursive(path_1.resolve(repos[i].basePath), async (path) => {
            if (path_1.extname(path) !== '.json') {
                return;
            }
            let contentJSON;
            try {
                const contentText = await util_1.promisify(fs_1.readFile)(path, { encoding: 'utf8' });
                contentJSON = JSON.parse(contentText);
            }
            catch (e) {
                log.appendLine(`Couldn't read content item at '${path}': ${e.toString()}`);
                return;
            }
            const folder = await getOrCreateFolderCached(context, path_1.dirname(path));
            const filteredContent = {
                id: contentJSON.id,
                label: contentJSON.label,
                locale: contentJSON.locale,
                body: contentJSON.body,
                deliveryId: contentJSON.deliveryId == contentJSON.Id || argv.excludeKeys ? undefined : contentJSON.deliveryId,
                folderId: folder == null ? null : folder.id,
                publish: contentJSON.lastPublishedVersion != null
            };
            if (argv.excludeKeys) {
                delete filteredContent.body._meta.deliveryKey;
            }
            schemaNames.add(contentJSON.body._meta.schema);
            contentItems.push({ repo: repo, content: new dc_management_sdk_js_1.ContentItem(filteredContent) });
        });
    }
    log.appendLine('Done. Validating content...');
    const alreadyExists = contentItems.filter(item => mapping.getContentItem(item.content.id) != null);
    if (alreadyExists.length > 0) {
        const updateExisting = force ||
            (await archive_helpers_1.asyncQuestion(`${alreadyExists.length} of the items being imported already exist in the mapping. Would you like to update these content items instead of skipping them? (y/n) `));
        if (!updateExisting) {
            contentItems = contentItems.filter(item => mapping.getContentItem(item.content.id) == null);
        }
    }
    let types;
    let schemas;
    try {
        types = await paginator_1.default(hub.related.contentTypes.list);
        schemas = await paginator_1.default(hub.related.contentTypeSchema.list);
    }
    catch (e) {
        console.error(`Could not load content types: ${e.toString()}`);
        return null;
    }
    const typesBySchema = new Map(types.map(type => [type.contentTypeUri, type]));
    const missingTypes = Array.from(schemaNames).filter(name => {
        return !typesBySchema.has(name);
    });
    if (missingTypes.length > 0) {
        const existing = schemas.filter(schema => missingTypes.indexOf(schema.schemaId) !== -1);
        log.appendLine('Required content types are missing from the target hub.');
        if (existing.length > 0) {
            log.appendLine('The following required content types schemas exist, but do not exist as content types:');
            existing.forEach(schema => {
                log.appendLine(`  ${schema.schemaId}`);
            });
            const create = force ||
                (await archive_helpers_1.asyncQuestion('Content types can be automatically created for these schemas, but it is not recommended as they will have a default name and lack any configuration. Are you sure you wish to continue? (y/n) '));
            if (!create) {
                return null;
            }
            for (let i = 0; i < existing.length; i++) {
                const missing = existing[i];
                let type = new dc_management_sdk_js_1.ContentType({
                    contentTypeUri: missing.schemaId,
                    settings: { label: path_1.basename(missing.schemaId) }
                });
                type = await hub.related.contentTypes.register(type);
                types.push(type);
                typesBySchema.set(missing.schemaId, type);
            }
        }
    }
    const repom = new Map();
    contentItems.forEach(item => {
        let repoSet = repom.get(item.repo);
        if (repoSet == null) {
            repoSet = new Set();
            repom.set(item.repo, repoSet);
        }
        const type = typesBySchema.get(item.content.body._meta.schema);
        if (type != null) {
            repoSet.add(type);
        }
    });
    const missingRepoAssignments = [];
    Array.from(repom).forEach(([repo, expectedTypes]) => {
        const expectedTypesArray = Array.from(expectedTypes);
        const missingTypes = expectedTypesArray.filter(expectedType => (repo.contentTypes || []).find(type => type.hubContentTypeId == expectedType.id) == null);
        missingTypes.forEach(missingType => missingRepoAssignments.push([repo, missingType]));
    });
    if (missingRepoAssignments.length > 0) {
        log.appendLine('Some content items are using types incompatible with the target repository. Missing assignments:');
        missingRepoAssignments.forEach(([repo, type]) => {
            let label = '<no label>';
            if (type.settings && type.settings.label) {
                label = type.settings.label;
            }
            log.appendLine(`  ${repo.label} - ${label} (${type.contentTypeUri})`);
        });
        const createAssignments = force ||
            (await archive_helpers_1.asyncQuestion('These assignments will be created automatically. Are you sure you still wish to continue? (y/n) '));
        if (!createAssignments) {
            return null;
        }
        try {
            await Promise.all(missingRepoAssignments.map(([repo, type]) => repo.related.contentTypes.assign(type.id)));
        }
        catch (e) {
            log.appendLine(`Failed creating repo assignments. Error: ${e.toString()}`);
            return null;
        }
    }
    const tree = new content_dependancy_tree_1.ContentDependancyTree(contentItems, mapping);
    const missingSchema = tree.requiredSchema.filter(schemaId => schemas.findIndex(schema => schema.schemaId === schemaId) === -1 &&
        types.findIndex(type => type.contentTypeUri === schemaId) === -1);
    if (missingSchema.length > 0) {
        log.appendLine('Required content type schema are missing from the target hub:');
        missingSchema.forEach(schema => log.appendLine(`  ${schema}`));
        log.appendLine('All content referencing this content type schema, and any content depending on those items will be skipped.');
        const affectedContentItems = tree.filterAny(item => {
            return missingSchema.indexOf(item.owner.content.body._meta.schema) !== -1;
        });
        const beforeRemove = tree.all.length;
        tree.removeContent(affectedContentItems);
        if (tree.all.length === 0) {
            log.appendLine('No content remains after removing those with missing content type schemas. Aborting.');
            return null;
        }
        const ignore = force ||
            (await archive_helpers_1.asyncQuestion(`${affectedContentItems.length} out of ${beforeRemove} content items will be skipped. Are you sure you still wish to continue? (y/n) `));
        if (!ignore) {
            return null;
        }
    }
    const missingIDs = new Set();
    const invalidContentItems = tree.filterAny(item => {
        const missingDeps = item.dependancies.filter(dep => !tree.byId.has(dep.dependancy.id) && mapping.getContentItem(dep.dependancy.id) == null);
        missingDeps.forEach(dep => {
            if (dep.dependancy.id != null) {
                missingIDs.add(dep.dependancy.id);
            }
        });
        return missingDeps.length > 0;
    });
    if (invalidContentItems.length > 0) {
        if (skipIncomplete) {
            tree.removeContent(invalidContentItems);
        }
        else {
            const validator = new amplience_schema_validator_1.AmplienceSchemaValidator(amplience_schema_validator_1.defaultSchemaLookup(types, schemas));
            const mustSkip = [];
            await Promise.all(invalidContentItems.map(async (item) => {
                tree.removeContentDependanciesFromBody(item.owner.content.body, item.dependancies.map(dependancy => dependancy.dependancy));
                try {
                    const errors = await validator.validate(item.owner.content.body);
                    if (errors.length > 0) {
                        mustSkip.push(item);
                    }
                }
                catch (_a) {
                }
            }));
            if (mustSkip.length > 0) {
                log.appendLine('Required dependancies for the following content items are missing, and would cause validation errors if set null.');
                log.appendLine('These items will be skipped:');
                mustSkip.forEach(item => log.appendLine(`  ${item.owner.content.label}`));
                tree.removeContent(mustSkip);
            }
        }
        log.appendLine('Referenced content items (targets of links/references) are missing from the import and mapping:');
        missingIDs.forEach(id => log.appendLine(`  ${id}`));
        const action = skipIncomplete ? 'skipped' : 'set as null';
        log.appendLine(`All references to these content items will be ${action}. Note: if you have already imported these items before, make sure you are using a mapping file from that import.`);
        if (tree.all.length === 0) {
            log.appendLine('No content remains after removing those with missing dependancies. Aborting.');
            return null;
        }
        invalidContentItems.forEach(item => log.appendLine(`  ${item.owner.content.label}`));
        const ignore = force ||
            (await archive_helpers_1.asyncQuestion(`${invalidContentItems.length} out of ${contentItems.length} content items will be affected. Are you sure you still wish to continue? (y/n) `));
        if (!ignore) {
            return null;
        }
    }
    log.appendLine(`Found ${tree.levels.length} dependancy levels in ${tree.all.length} items, ${tree.circularLinks.length} referencing a circular dependancy.`);
    log.appendLine(`Importing ${tree.all.length} content items...`);
    return tree;
};
const rewriteDependancy = (dep, mapping) => {
    const id = mapping.getContentItem(dep.dependancy.id) || dep.dependancy.id;
    if (dep.dependancy._meta.schema === '_hierarchy') {
        dep.owner.content.body._meta.hierarchy.parentId = id;
    }
    else {
        dep.dependancy.id = id;
    }
};
const importTree = async (client, tree, mapping, log, argv) => {
    const abort = (error) => {
        log.appendLine(`Importing content item failed, aborting. Error: ${error.toString()}`);
    };
    let publishable = [];
    for (let i = 0; i < tree.levels.length; i++) {
        const level = tree.levels[i];
        for (let j = 0; j < level.items.length; j++) {
            const item = level.items[j];
            const content = item.owner.content;
            item.dependancies.forEach(dep => {
                rewriteDependancy(dep, mapping);
            });
            const originalId = content.id;
            content.id = mapping.getContentItem(content.id) || '';
            let newItem;
            let oldVersion;
            try {
                const result = await createOrUpdateContent(client, item.owner.repo, mapping.getContentItem(originalId) || null, content);
                newItem = result.newItem;
                oldVersion = result.oldVersion;
            }
            catch (e) {
                log.appendLine(`Failed creating ${content.label}.`);
                abort(e);
                return false;
            }
            const updated = oldVersion > 0;
            log.addComment(`${updated ? 'Updated' : 'Created'} ${content.label}.`);
            log.addAction(updated ? 'UPDATE' : 'CREATE', (newItem.id || 'unknown') + (updated ? ` ${oldVersion} ${newItem.version}` : ''));
            if (itemShouldPublish(content) && (newItem.version != oldVersion || argv.republish)) {
                publishable.push({ item: newItem, node: item });
            }
            mapping.registerContentItem(originalId, newItem.id);
        }
    }
    let publishChildren = 0;
    publishable = publishable.filter(entry => {
        let isTopLevel = true;
        tree.traverseDependants(entry.node, dependant => {
            if (dependant != entry.node && publishable.findIndex(entry => entry.node === dependant) !== -1) {
                isTopLevel = false;
            }
        }, true);
        if (!isTopLevel) {
            publishChildren++;
        }
        return isTopLevel;
    });
    const newDependants = [];
    for (let pass = 0; pass < 2; pass++) {
        const mode = pass === 0 ? 'Creating' : 'Resolving';
        log.appendLine(`${mode} circular dependants.`);
        for (let i = 0; i < tree.circularLinks.length; i++) {
            const item = tree.circularLinks[i];
            const content = item.owner.content;
            item.dependancies.forEach(dep => {
                rewriteDependancy(dep, mapping);
            });
            const originalId = content.id;
            content.id = mapping.getContentItem(content.id) || '';
            let newItem;
            let oldVersion;
            try {
                const result = await createOrUpdateContent(client, item.owner.repo, newDependants[i] || mapping.getContentItem(originalId), content);
                newItem = result.newItem;
                oldVersion = result.oldVersion;
            }
            catch (e) {
                log.appendLine(`Failed creating ${content.label}.`);
                abort(e);
                return false;
            }
            if (pass === 0) {
                const updated = oldVersion > 0;
                log.addComment(`${updated ? 'Updated' : 'Created'} ${content.label}.`);
                log.addAction(updated ? 'UPDATE' : 'CREATE', (newItem.id || 'unknown') + (updated ? ` ${oldVersion} ${newItem.version}` : ''));
                newDependants[i] = newItem;
                mapping.registerContentItem(originalId, newItem.id);
            }
            else {
                if (itemShouldPublish(content) && (newItem.version != oldVersion || argv.republish)) {
                    publishable.push({ item: newItem, node: item });
                }
            }
        }
    }
    if (argv.publish) {
        const pubQueue = new publish_queue_1.PublishQueue(argv);
        log.appendLine(`Publishing ${publishable.length} items. (${publishChildren} children included)`);
        for (let i = 0; i < publishable.length; i++) {
            const item = publishable[i].item;
            try {
                pubQueue.publish(item);
                log.appendLine(`Started publish for ${item.label}.`);
            }
            catch (e) {
                log.appendLine(`Failed to initiate publish for ${item.label}: ${e.toString()}`);
            }
        }
        log.appendLine(`Waiting for all publishes to complete...`);
        await pubQueue.waitForAll();
        log.appendLine(`Finished publishing, with ${pubQueue.failedJobs.length} failed publishes total.`);
        pubQueue.failedJobs.forEach(job => {
            log.appendLine(` - ${job.item.label}`);
        });
    }
    log.appendLine('Done!');
    return true;
};
exports.handler = async (argv) => {
    if (argv.revertLog != null) {
        return import_revert_1.revert(argv);
    }
    const { dir, baseRepo, baseFolder, validate, logFile } = argv;
    const force = argv.force || false;
    let { mapFile } = argv;
    argv.publish = argv.publish || argv.republish;
    const client = dynamic_content_client_factory_1.default(argv);
    const log = typeof logFile === 'string' || logFile == null ? new file_log_1.FileLog(logFile) : logFile;
    const closeLog = async () => {
        if (typeof logFile !== 'object') {
            await log.close();
        }
    };
    let hub;
    try {
        hub = await client.hubs.get(argv.hubId);
    }
    catch (e) {
        console.error(`Couldn't get hub: ${e.toString()}`);
        closeLog();
        return false;
    }
    let importTitle = 'unknownImport';
    if (baseFolder != null) {
        importTitle = `folder-${baseFolder}`;
    }
    else if (baseRepo != null) {
        importTitle = `repo-${baseRepo}`;
    }
    else {
        importTitle = `hub-${hub.id}`;
    }
    const mapping = new content_mapping_1.ContentMapping();
    if (mapFile == null) {
        mapFile = getDefaultMappingPath(importTitle);
    }
    if (await mapping.load(mapFile)) {
        log.appendLine(`Existing mapping loaded from '${mapFile}', changes will be saved back to it.`);
    }
    else {
        log.appendLine(`Creating new mapping file at '${mapFile}'.`);
    }
    let tree;
    if (baseFolder != null) {
        let repo;
        let folder;
        try {
            const bFolder = await client.folders.get(baseFolder);
            repo = await bFolder.related.contentRepository();
            folder = bFolder;
        }
        catch (e) {
            console.error(`Couldn't get base folder: ${e.toString()}`);
            closeLog();
            return false;
        }
        tree = await prepareContentForImport(client, hub, [{ repo, basePath: dir }], folder, mapping, log, argv);
    }
    else if (baseRepo != null) {
        let repo;
        try {
            repo = await client.contentRepositories.get(baseRepo);
        }
        catch (e) {
            console.error(`Couldn't get base repository: ${e.toString()}`);
            closeLog();
            return false;
        }
        tree = await prepareContentForImport(client, hub, [{ repo, basePath: dir }], null, mapping, log, argv);
    }
    else {
        let repos;
        try {
            repos = await paginator_1.default(hub.related.contentRepositories.list);
        }
        catch (e) {
            log.appendLine(`Couldn't get repositories: ${e.toString()}`);
            closeLog();
            return false;
        }
        const baseDirContents = await util_1.promisify(fs_1.readdir)(dir);
        const importRepos = [];
        const missingRepos = [];
        for (let i = 0; i < baseDirContents.length; i++) {
            const name = baseDirContents[i];
            const path = path_1.join(dir, name);
            const status = await util_1.promisify(fs_1.lstat)(path);
            if (status.isDirectory()) {
                const match = repos.find(repo => repo.label === name);
                if (match) {
                    importRepos.push({ basePath: path, repo: match });
                }
                else {
                    missingRepos.push(name);
                }
            }
        }
        if (missingRepos.length > 0) {
            log.appendLine("The following repositories must exist on the destination hub to import content into them, but don't:");
            missingRepos.forEach(name => {
                log.appendLine(`  ${name}`);
            });
            if (importRepos.length > 0) {
                const ignore = force ||
                    (await archive_helpers_1.asyncQuestion('These repositories will be skipped during the import, as they need to be added to the hub manually. Do you want to continue? (y/n) '));
                if (!ignore) {
                    closeLog();
                    return false;
                }
            }
        }
        if (importRepos.length == 0) {
            log.appendLine('Could not find any matching repositories to import into, aborting.');
            closeLog();
            return false;
        }
        tree = await prepareContentForImport(client, hub, importRepos, null, mapping, log, argv);
    }
    let result = true;
    if (tree != null) {
        if (!validate) {
            result = await importTree(client, tree, mapping, log, argv);
        }
        else {
            log.appendLine('--validate was passed, so no content was imported.');
        }
    }
    trySaveMapping(mapFile, mapping, log);
    closeLog();
    return result;
};

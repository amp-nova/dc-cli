"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const lodash_1 = require("lodash");
const table_1 = require("table");
const chalk_1 = __importDefault(require("chalk"));
const import_service_1 = require("../../services/import.service");
const table_consts_1 = require("../../common/table/table.consts");
exports.command = 'import <dir>';
exports.desc = 'Import Content Types';
exports.builder = (yargs) => {
    yargs.positional('dir', {
        describe: 'Path to Content Type definitions',
        type: 'string'
    });
    yargs.option('sync', {
        describe: 'Automatically sync Content Type schema',
        type: 'boolean',
        default: false
    });
};
class ContentTypeWithRepositoryAssignments extends dc_management_sdk_js_1.ContentType {
}
exports.ContentTypeWithRepositoryAssignments = ContentTypeWithRepositoryAssignments;
exports.storedContentTypeMapper = (contentType, storedContentTypes) => {
    const found = storedContentTypes.find(storedContentType => storedContentType.contentTypeUri === contentType.contentTypeUri);
    const mutatedContentType = found ? { ...contentType, id: found.id } : contentType;
    return new ContentTypeWithRepositoryAssignments(mutatedContentType);
};
exports.validateNoDuplicateContentTypeUris = (importedContentTypes) => {
    const uriToFilenameMap = new Map();
    for (const [filename, contentType] of Object.entries(importedContentTypes)) {
        if (contentType.contentTypeUri) {
            const otherFilenames = uriToFilenameMap.get(contentType.contentTypeUri) || [];
            if (filename) {
                uriToFilenameMap.set(contentType.contentTypeUri, [...otherFilenames, filename]);
            }
        }
    }
    const uniqueDuplicateUris = [];
    uriToFilenameMap.forEach((filenames, uri) => {
        if (filenames.length > 1) {
            uniqueDuplicateUris.push([uri, filenames]);
        }
    });
    if (uniqueDuplicateUris.length > 0) {
        throw new Error(`Content Types must have unique uri values. Duplicate values found:-\n${uniqueDuplicateUris
            .map(([uri, filenames]) => `  uri: '${uri}' in files: [${filenames.map(f => `'${f}'`).join(', ')}]`)
            .join('\n')}`);
    }
};
exports.doCreate = async (hub, contentType) => {
    try {
        return await hub.related.contentTypes.register(new dc_management_sdk_js_1.ContentType(contentType));
    }
    catch (err) {
        throw new Error(`Error registering content type ${contentType.contentTypeUri}: ${err.message || err}`);
    }
};
const equals = (a, b) => a.id === b.id && a.contentTypeUri === b.contentTypeUri && lodash_1.isEqual(a.settings, b.settings);
exports.doUpdate = async (client, contentType) => {
    let retrievedContentType;
    try {
        retrievedContentType = await client.contentTypes.get(contentType.id || '');
    }
    catch (err) {
        throw new Error(`Error unable to get content type ${contentType.id}: ${err.message}`);
    }
    contentType.settings = { ...retrievedContentType.settings, ...contentType.settings };
    let updatedContentType;
    if (equals(retrievedContentType, contentType)) {
        return { contentType: retrievedContentType, updateStatus: import_service_1.UpdateStatus.SKIPPED };
    }
    try {
        updatedContentType = await retrievedContentType.related.update(contentType);
        return { contentType: updatedContentType, updateStatus: import_service_1.UpdateStatus.UPDATED };
    }
    catch (err) {
        throw new Error(`Error updating content type ${contentType.id}: ${err.message || err}`);
    }
};
exports.doSync = async (client, contentType) => {
    let retrievedContentType;
    try {
        retrievedContentType = await client.contentTypes.get(contentType.id || '');
    }
    catch (err) {
        throw new Error(`Error unable to get content type ${contentType.id}: ${err.message}`);
    }
    try {
        await retrievedContentType.related.contentTypeSchema.update();
        return { contentType: retrievedContentType, updateStatus: import_service_1.UpdateStatus.UPDATED };
    }
    catch (err) {
        throw new Error(`Error updating the content type schema of the content type ${contentType.id}: ${err.message}`);
    }
};
const validateRepositories = (repositories) => Array.isArray(repositories) && repositories.every(repo => typeof repo === 'string');
exports.synchronizeContentTypeRepositories = async (contentType, namedRepositories) => {
    if (!validateRepositories(contentType.repositories)) {
        throw new Error('Invalid format supplied for repositories. Please provide an array of repository names');
    }
    const assignedRepositories = new Map();
    namedRepositories.forEach(contentRepository => {
        const contentRepositoryContentTypes = contentRepository.contentTypes || [];
        contentRepositoryContentTypes.forEach(assignedContentTypes => {
            if (assignedContentTypes.hubContentTypeId === contentType.id) {
                assignedRepositories.set(contentRepository.name || '', contentRepository);
            }
        });
    });
    const contentTypeId = contentType.id || '';
    const definedContentRepository = (contentType.repositories || []).filter((value, index, array) => array.indexOf(value) === index);
    let changedAssignment = false;
    for (const repo of definedContentRepository) {
        if (!assignedRepositories.has(repo)) {
            const contentRepository = namedRepositories.get(repo);
            if (!contentRepository) {
                throw new Error(`Unable to find a Content Repository named: ${repo}`);
            }
            await contentRepository.related.contentTypes.assign(contentTypeId);
            changedAssignment = true;
        }
        else {
            assignedRepositories.delete(repo);
        }
    }
    for (const assignedRepository of assignedRepositories.values()) {
        await assignedRepository.related.contentTypes.unassign(contentTypeId);
        changedAssignment = true;
    }
    return changedAssignment;
};
exports.processContentTypes = async (contentTypes, client, hub, sync) => {
    const tableStream = table_1.createStream(table_consts_1.streamTableOptions);
    const contentRepositoryList = await paginator_1.default(hub.related.contentRepositories.list, {});
    const namedRepositories = new Map(contentRepositoryList.map(value => [value.name || '', value]));
    tableStream.write([chalk_1.default.bold('ID'), chalk_1.default.bold('Schema ID'), chalk_1.default.bold('Result')]);
    for (const contentType of contentTypes) {
        let status;
        let contentTypeResult;
        if (contentType.id) {
            status = 'UP-TO-DATE';
            const result = await exports.doUpdate(client, contentType);
            if (result.updateStatus === import_service_1.UpdateStatus.UPDATED) {
                status = 'UPDATED';
            }
            contentTypeResult = result.contentType;
            if (sync) {
                const syncResult = await exports.doSync(client, contentType);
                if (syncResult.updateStatus === import_service_1.UpdateStatus.UPDATED) {
                    status = 'UPDATED';
                }
            }
        }
        else {
            contentTypeResult = await exports.doCreate(hub, contentType);
            status = 'CREATED';
        }
        if (contentType.repositories &&
            (await exports.synchronizeContentTypeRepositories(new ContentTypeWithRepositoryAssignments({ ...contentType, ...contentTypeResult }), namedRepositories))) {
            status = contentType.id ? 'UPDATED' : 'CREATED';
        }
        tableStream.write([contentTypeResult.id || 'UNKNOWN', contentType.contentTypeUri || '', status]);
    }
    process.stdout.write('\n');
};
exports.handler = async (argv) => {
    const { dir, sync } = argv;
    const importedContentTypes = import_service_1.loadJsonFromDirectory(dir, ContentTypeWithRepositoryAssignments);
    if (Object.keys(importedContentTypes).length === 0) {
        throw new Error(`No content types found in ${dir}`);
    }
    exports.validateNoDuplicateContentTypeUris(importedContentTypes);
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const activeContentTypes = await paginator_1.default(hub.related.contentTypes.list, { status: 'ACTIVE' });
    const archivedContentTypes = await paginator_1.default(hub.related.contentTypes.list, { status: 'ARCHIVED' });
    const storedContentTypes = [...activeContentTypes, ...archivedContentTypes];
    for (const [filename, importedContentType] of Object.entries(importedContentTypes)) {
        importedContentTypes[filename] = exports.storedContentTypeMapper(importedContentType, storedContentTypes);
    }
    await exports.processContentTypes(Object.values(importedContentTypes), client, hub, sync);
};

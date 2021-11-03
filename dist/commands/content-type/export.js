"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const table_1 = require("table");
const table_consts_1 = require("../../common/table/table.consts");
const chalk_1 = __importDefault(require("chalk"));
const export_service_1 = require("../../services/export.service");
const import_service_1 = require("../../services/import.service");
const import_1 = require("./import");
const lodash_1 = require("lodash");
const directory_utils_1 = require("../../common/import/directory-utils");
exports.command = 'export <dir>';
exports.desc = 'Export Content Types';
exports.builder = (yargs) => {
    yargs
        .positional('dir', {
        describe: 'Output directory for the exported Content Type definitions',
        type: 'string'
    })
        .option('schemaId', {
        type: 'string',
        describe: 'The Schema ID of a Content Type to be exported.\nIf no --schemaId option is given, all content types for the hub are exported.\nA single --schemaId option may be given to export a single content type.\nMultiple --schemaId options may be given to export multiple content types at the same time.',
        requiresArg: true
    })
        .option('archived', {
        type: 'boolean',
        describe: 'If present, archived content types will also be considered.',
        boolean: true
    });
};
const equals = (a, b) => a.contentTypeUri === b.contentTypeUri && lodash_1.isEqual(a.settings, b.settings);
exports.filterContentTypesByUri = (listToFilter, contentTypeUriList) => {
    if (contentTypeUriList.length === 0) {
        return listToFilter;
    }
    const unmatchedContentTypeUriList = contentTypeUriList.filter(uri => !listToFilter.some(contentType => contentType.contentTypeUri === uri));
    if (unmatchedContentTypeUriList.length > 0) {
        throw new Error(`The following schema ID(s) could not be found: [${unmatchedContentTypeUriList
            .map(u => `'${u}'`)
            .join(', ')}].\nNothing was exported, exiting.`);
    }
    return listToFilter.filter(contentType => contentTypeUriList.some(uri => contentType.contentTypeUri === uri));
};
exports.getExportRecordForContentType = (contentType, outputDir, previouslyExportedContentTypes) => {
    const indexOfExportedContentType = Object.values(previouslyExportedContentTypes).findIndex(c => c.contentTypeUri === contentType.contentTypeUri);
    if (indexOfExportedContentType < 0) {
        const filename = export_service_1.uniqueFilename(outputDir, contentType.contentTypeUri, 'json', Object.keys(previouslyExportedContentTypes));
        previouslyExportedContentTypes[filename] = contentType;
        return {
            filename: filename,
            status: 'CREATED',
            contentType
        };
    }
    const filename = Object.keys(previouslyExportedContentTypes)[indexOfExportedContentType];
    const previouslyExportedContentType = Object.values(previouslyExportedContentTypes)[indexOfExportedContentType];
    if (equals(previouslyExportedContentType, contentType)) {
        return { filename, status: 'UP-TO-DATE', contentType };
    }
    return {
        filename,
        status: 'UPDATED',
        contentType
    };
};
exports.getContentTypeExports = (outputDir, previouslyExportedContentTypes, contentTypesBeingExported) => {
    const allExports = [];
    const updatedExportsMap = [];
    for (const contentType of contentTypesBeingExported) {
        if (!contentType.contentTypeUri) {
            continue;
        }
        const exportRecord = exports.getExportRecordForContentType(contentType, outputDir, previouslyExportedContentTypes);
        allExports.push(exportRecord);
        if (exportRecord.status === 'UPDATED') {
            updatedExportsMap.push({ uri: contentType.contentTypeUri, filename: exportRecord.filename });
        }
    }
    return [allExports, updatedExportsMap];
};
exports.processContentTypes = async (outputDir, previouslyExportedContentTypes, contentTypesBeingExported) => {
    if (contentTypesBeingExported.length === 0) {
        export_service_1.nothingExportedExit('No content types to export from this hub, exiting.\n');
    }
    const [allExports, updatedExportsMap] = exports.getContentTypeExports(outputDir, previouslyExportedContentTypes, contentTypesBeingExported);
    if (allExports.length === 0 ||
        (Object.keys(updatedExportsMap).length > 0 && !(await export_service_1.promptToOverwriteExports(updatedExportsMap)))) {
        export_service_1.nothingExportedExit();
    }
    await directory_utils_1.ensureDirectoryExists(outputDir);
    const tableStream = table_1.createStream(table_consts_1.streamTableOptions);
    tableStream.write([chalk_1.default.bold('File'), chalk_1.default.bold('Schema ID'), chalk_1.default.bold('Result')]);
    for (const { filename, status, contentType } of allExports) {
        if (status !== 'UP-TO-DATE') {
            delete contentType.id;
            export_service_1.writeJsonToFile(filename, contentType);
        }
        tableStream.write([filename, contentType.contentTypeUri || '', status]);
    }
    process.stdout.write('\n');
};
exports.handler = async (argv) => {
    const { dir, schemaId } = argv;
    const previouslyExportedContentTypes = import_service_1.loadJsonFromDirectory(dir, dc_management_sdk_js_1.ContentType);
    import_1.validateNoDuplicateContentTypeUris(previouslyExportedContentTypes);
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const storedContentTypes = await paginator_1.default(hub.related.contentTypes.list, { status: 'ACTIVE' });
    if (argv.archived) {
        const archivedContentTypes = await paginator_1.default(hub.related.contentTypes.list, { status: 'ARCHIVED' });
        Array.prototype.push.apply(storedContentTypes, archivedContentTypes);
    }
    const schemaIdArray = schemaId ? (Array.isArray(schemaId) ? schemaId : [schemaId]) : [];
    const filteredContentTypes = exports.filterContentTypesByUri(storedContentTypes, schemaIdArray);
    await exports.processContentTypes(dir, previouslyExportedContentTypes, filteredContentTypes);
};

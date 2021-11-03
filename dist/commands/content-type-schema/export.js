"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const resolve_schema_body_1 = require("../../services/resolve-schema-body");
const directory_utils_1 = require("../../common/import/directory-utils");
exports.streamTableOptions = {
    ...table_consts_1.baseTableConfig,
    columnDefault: {
        width: 50
    },
    columnCount: 4,
    columns: {
        0: {
            width: 30
        },
        1: {
            width: 30
        },
        2: {
            width: 100
        },
        3: {
            width: 10
        }
    }
};
exports.command = 'export <dir>';
exports.desc = 'Export Content Type Schemas';
exports.builder = (yargs) => {
    yargs
        .positional('dir', {
        describe: 'Output directory for the exported Content Type Schema definitions',
        type: 'string'
    })
        .option('schemaId', {
        type: 'string',
        describe: 'The Schema ID of a Content Type Schema to be exported.\nIf no --schemaId option is given, all content type schemas for the hub are exported.\nA single --schemaId option may be given to export a single content type schema.\nMultiple --schemaId options may be given to export multiple content type schemas at the same time.',
        requiresArg: true
    })
        .option('archived', {
        type: 'boolean',
        describe: 'If present, archived content type schemas will also be considered.',
        boolean: true
    });
};
const equals = (a, b) => a.schemaId === b.schemaId && a.body === b.body && a.validationLevel === b.validationLevel;
const SCHEMA_DIR = 'schemas';
exports.generateSchemaPath = (filepath) => SCHEMA_DIR + path.sep + path.basename(filepath).replace('.json', '-schema.json');
exports.writeSchemaBody = (filename, body) => {
    if (!body) {
        return;
    }
    const dir = path.dirname(filename);
    if (fs.existsSync(dir)) {
        const dirStat = fs.lstatSync(dir);
        if (!dirStat || !dirStat.isDirectory()) {
            throw new Error(`Unable to write schema to "${filename}" as "${dir}" is not a directory.`);
        }
    }
    else {
        try {
            fs.mkdirSync(dir);
        }
        catch (_a) {
            throw new Error(`Unable to create directory: "${dir}".`);
        }
    }
    try {
        fs.writeFileSync(filename, body);
    }
    catch (_b) {
        throw new Error(`Unable to write file: "${filename}".`);
    }
};
exports.getExportRecordForContentTypeSchema = (contentTypeSchema, outputDir, previouslyExportedContentTypeSchemas) => {
    const indexOfExportedContentTypeSchema = Object.values(previouslyExportedContentTypeSchemas).findIndex(c => c.schemaId === contentTypeSchema.schemaId);
    if (indexOfExportedContentTypeSchema < 0) {
        const filename = export_service_1.uniqueFilename(outputDir, contentTypeSchema.schemaId, 'json', Object.keys(previouslyExportedContentTypeSchemas));
        previouslyExportedContentTypeSchemas[filename] = contentTypeSchema;
        return {
            filename: filename,
            status: 'CREATED',
            contentTypeSchema
        };
    }
    const filename = Object.keys(previouslyExportedContentTypeSchemas)[indexOfExportedContentTypeSchema];
    const previouslyExportedContentTypeSchema = Object.values(previouslyExportedContentTypeSchemas)[indexOfExportedContentTypeSchema];
    if (equals(previouslyExportedContentTypeSchema, contentTypeSchema)) {
        return { filename, status: 'UP-TO-DATE', contentTypeSchema };
    }
    return {
        filename,
        status: 'UPDATED',
        contentTypeSchema
    };
};
exports.filterContentTypeSchemasBySchemaId = (listToFilter, listToMatch = []) => {
    if (listToMatch.length === 0) {
        return listToFilter;
    }
    const unmatchedIdList = listToMatch.filter(id => !listToFilter.some(schema => schema.schemaId === id));
    if (unmatchedIdList.length > 0) {
        throw new Error(`The following schema ID(s) could not be found: [${unmatchedIdList
            .map(u => `'${u}'`)
            .join(', ')}].\nNothing was exported, exiting.`);
    }
    return listToFilter.filter(schema => listToMatch.some(id => schema.schemaId === id));
};
exports.getContentTypeSchemaExports = (outputDir, previouslyExportedContentTypeSchemas, contentTypeSchemasBeingExported) => {
    const allExports = [];
    const updatedExportsMap = [];
    for (const contentTypeSchema of contentTypeSchemasBeingExported) {
        if (!contentTypeSchema.schemaId) {
            continue;
        }
        const exportRecord = exports.getExportRecordForContentTypeSchema(contentTypeSchema, outputDir, previouslyExportedContentTypeSchemas);
        allExports.push(exportRecord);
        if (exportRecord.status === 'UPDATED') {
            updatedExportsMap.push({ schemaId: contentTypeSchema.schemaId, filename: exportRecord.filename });
        }
    }
    return [allExports, updatedExportsMap];
};
exports.processContentTypeSchemas = async (outputDir, previouslyExportedContentTypeSchemas, storedContentTypeSchemas) => {
    if (storedContentTypeSchemas.length === 0) {
        export_service_1.nothingExportedExit('No content type schemas to export from this hub, exiting.\n');
    }
    const [allExports, updatedExportsMap] = exports.getContentTypeSchemaExports(outputDir, previouslyExportedContentTypeSchemas, storedContentTypeSchemas);
    if (allExports.length === 0 ||
        (Object.keys(updatedExportsMap).length > 0 && !(await export_service_1.promptToOverwriteExports(updatedExportsMap)))) {
        export_service_1.nothingExportedExit();
    }
    await directory_utils_1.ensureDirectoryExists(outputDir);
    const tableStream = table_1.createStream(exports.streamTableOptions);
    tableStream.write([chalk_1.default.bold('File'), chalk_1.default.bold('Schema file'), chalk_1.default.bold('Schema ID'), chalk_1.default.bold('Result')]);
    for (const { filename, status, contentTypeSchema } of allExports) {
        let schemaFilename = '';
        if (status !== 'UP-TO-DATE') {
            delete contentTypeSchema.id;
            const schemaBody = contentTypeSchema.body;
            const schemaBodyFilename = exports.generateSchemaPath(filename);
            contentTypeSchema.body = '.' + path.sep + schemaBodyFilename;
            schemaFilename = outputDir + path.sep + schemaBodyFilename;
            exports.writeSchemaBody(schemaFilename, schemaBody);
            export_service_1.writeJsonToFile(filename, new dc_management_sdk_js_1.ContentTypeSchema({
                body: contentTypeSchema.body,
                schemaId: contentTypeSchema.schemaId,
                validationLevel: contentTypeSchema.validationLevel
            }));
        }
        tableStream.write([filename, schemaFilename, contentTypeSchema.schemaId || '', status]);
    }
    process.stdout.write('\n');
};
exports.handler = async (argv) => {
    const { dir, schemaId } = argv;
    const [contentTypeSchemas] = await resolve_schema_body_1.resolveSchemaBody(import_service_1.loadJsonFromDirectory(dir, dc_management_sdk_js_1.ContentTypeSchema), dir);
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const storedContentTypeSchemas = await paginator_1.default(hub.related.contentTypeSchema.list, argv.archived ? undefined : { status: 'ACTIVE' });
    const schemaIdArray = schemaId ? (Array.isArray(schemaId) ? schemaId : [schemaId]) : [];
    const filteredContentTypeSchemas = exports.filterContentTypeSchemasBySchemaId(storedContentTypeSchemas, schemaIdArray);
    await exports.processContentTypeSchemas(dir, contentTypeSchemas, filteredContentTypeSchemas);
};

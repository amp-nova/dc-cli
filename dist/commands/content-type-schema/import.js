"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const table_1 = require("table");
const table_consts_1 = require("../../common/table/table.consts");
const chalk_1 = __importDefault(require("chalk"));
const create_service_1 = require("./create.service");
const update_service_1 = require("./update.service");
const import_service_1 = require("../../services/import.service");
const resolve_schema_body_1 = require("../../services/resolve-schema-body");
exports.command = 'import <dir>';
exports.desc = 'Import Content Type Schemas';
exports.builder = (yargs) => {
    yargs.positional('dir', {
        describe: 'Directory containing Content Type Schema definitions',
        type: 'string'
    });
};
exports.storedSchemaMapper = (schema, storedSchemas) => {
    const found = storedSchemas.find(stored => stored.schemaId === schema.schemaId);
    const mutatedSchema = found ? { ...schema, id: found.id } : schema;
    return new dc_management_sdk_js_1.ContentTypeSchema(mutatedSchema);
};
exports.doCreate = async (hub, schema) => {
    try {
        const createdSchemaType = await create_service_1.createContentTypeSchema(schema.body || '', schema.validationLevel || dc_management_sdk_js_1.ValidationLevel.CONTENT_TYPE, hub);
        return createdSchemaType;
    }
    catch (err) {
        throw new Error(`Error registering content type schema with body: ${schema.body}\n\n${err}`);
    }
};
const equals = (a, b) => a.id === b.id && a.schemaId === b.schemaId && a.body === b.body && a.validationLevel === b.validationLevel;
exports.doUpdate = async (client, schema) => {
    try {
        const retrievedSchema = await client.contentTypeSchemas.get(schema.id || '');
        if (equals(retrievedSchema, schema)) {
            return { contentTypeSchema: retrievedSchema, updateStatus: import_service_1.UpdateStatus.SKIPPED };
        }
        const updatedSchema = await update_service_1.updateContentTypeSchema(retrievedSchema, schema.body || '', schema.validationLevel || dc_management_sdk_js_1.ValidationLevel.CONTENT_TYPE);
        return { contentTypeSchema: updatedSchema, updateStatus: import_service_1.UpdateStatus.UPDATED };
    }
    catch (err) {
        throw new Error(`Error updating content type schema ${schema.schemaId || '<unknown>'}: ${err.message}`);
    }
};
exports.processSchemas = async (schemasToProcess, client, hub) => {
    const tableStream = table_1.createStream(table_consts_1.streamTableOptions);
    tableStream.write([chalk_1.default.bold('ID'), chalk_1.default.bold('Schema ID'), chalk_1.default.bold('Result')]);
    for (const schema of schemasToProcess) {
        let status;
        let contentTypeSchema;
        if (schema.id) {
            const result = await exports.doUpdate(client, schema);
            contentTypeSchema = result.contentTypeSchema;
            status = result.updateStatus === import_service_1.UpdateStatus.SKIPPED ? 'UP-TO-DATE' : 'UPDATED';
        }
        else {
            contentTypeSchema = await exports.doCreate(hub, schema);
            status = 'CREATED';
        }
        tableStream.write([contentTypeSchema.id || '', contentTypeSchema.schemaId || '', status]);
    }
    process.stdout.write('\n');
};
exports.handler = async (argv) => {
    const { dir } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const schemas = import_service_1.loadJsonFromDirectory(dir, dc_management_sdk_js_1.ContentTypeSchema);
    const [resolvedSchemas, resolveSchemaErrors] = await resolve_schema_body_1.resolveSchemaBody(schemas, dir);
    if (Object.keys(resolveSchemaErrors).length > 0) {
        const errors = Object.entries(resolveSchemaErrors)
            .map(value => {
            const [filename, error] = value;
            return `* ${filename} -> ${error}`;
        })
            .join('\n');
        throw new Error(`Unable to resolve the body for the following files:\n${errors}`);
    }
    const storedSchemas = await paginator_1.default(hub.related.contentTypeSchema.list);
    const schemasToProcess = Object.values(resolvedSchemas).map(resolvedSchema => exports.storedSchemaMapper(resolvedSchema, storedSchemas));
    await exports.processSchemas(schemasToProcess, client, hub);
};

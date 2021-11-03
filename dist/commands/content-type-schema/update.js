"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const data_presenter_1 = __importStar(require("../../view/data-presenter"));
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const json_resolver_1 = require("../../common/json-resolver/json-resolver");
const table_consts_1 = require("../../common/table/table.consts");
const update_service_1 = require("./update.service");
exports.command = 'update <id>';
exports.desc = 'Update Content Type Schema';
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        describe: 'Content Type Schema ID',
        type: 'string'
    })
        .options({
        schema: {
            type: 'string',
            demandOption: true,
            description: 'Content Type Schema Source Location',
            requiresArg: true
        },
        validationLevel: {
            type: 'string',
            choices: Object.values(dc_management_sdk_js_1.ValidationLevel),
            demandOption: true,
            description: 'Content Type Schema Validation Level',
            requiresArg: true
        },
        ...data_presenter_1.RenderingOptions
    });
};
exports.handler = async (argv) => {
    const { id, schema, validationLevel } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    const schemaBody = await json_resolver_1.jsonResolver(schema);
    const contentTypeSchema = await client.contentTypeSchemas.get(id);
    const contentTypeSchemaResult = await update_service_1.updateContentTypeSchema(contentTypeSchema, schemaBody, validationLevel);
    new data_presenter_1.default(contentTypeSchemaResult.toJSON()).render({
        json: argv.json,
        tableUserConfig: table_consts_1.singleItemTableOptions
    });
};

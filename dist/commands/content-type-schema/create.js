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
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const table_consts_1 = require("../../common/table/table.consts");
const create_service_1 = require("./create.service");
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const json_resolver_1 = require("../../common/json-resolver/json-resolver");
exports.command = 'create';
exports.desc = 'Create Content Type Schema';
exports.builder = {
    schema: {
        type: 'string',
        demandOption: true,
        description: 'content-type-schema Source Location',
        requiresArg: true
    },
    validationLevel: {
        type: 'string',
        choices: Object.values(dc_management_sdk_js_1.ValidationLevel),
        demandOption: true,
        description: 'content-type-schema Validation Level',
        requiresArg: true
    },
    ...data_presenter_1.RenderingOptions
};
exports.handler = async (argv) => {
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const schemaBody = await json_resolver_1.jsonResolver(argv.schema);
    const contentTypeSchemaResult = await create_service_1.createContentTypeSchema(schemaBody, argv.validationLevel, hub);
    return new data_presenter_1.default(contentTypeSchemaResult.toJSON()).render({
        json: argv.json,
        tableUserConfig: table_consts_1.singleItemTableOptions
    });
};

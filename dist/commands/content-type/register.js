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
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const yargs_object_transformer_1 = require("../../common/yargs/yargs-object-transformer");
const table_consts_1 = require("../../common/table/table.consts");
exports.command = 'register';
exports.desc = 'Register a Content Type';
exports.builder = {
    schemaId: {
        type: 'string',
        demandOption: true,
        describe: 'content-type-schema ID',
        requiresArg: true
    },
    label: {
        type: 'string',
        demandOption: true,
        describe: 'content-type label',
        requiresArg: true
    },
    icons: {
        describe: 'content-type icons',
        default: {}
    },
    visualizations: {
        describe: 'content-type visualizations',
        default: {}
    },
    cards: {
        describe: 'content-type cards',
        default: {}
    },
    ...data_presenter_1.RenderingOptions
};
exports.handler = async (argv) => {
    const client = dynamic_content_client_factory_1.default(argv);
    const { hubId, schemaId, label, icons, visualizations, cards } = argv;
    const hub = await client.hubs.get(hubId);
    const contentType = new dc_management_sdk_js_1.ContentType({
        contentTypeUri: schemaId,
        settings: {
            label: label,
            icons: yargs_object_transformer_1.transformYargObjectToArray(icons),
            visualizations: yargs_object_transformer_1.transformYargObjectToArray(visualizations),
            cards: yargs_object_transformer_1.transformYargObjectToArray(cards)
        }
    });
    const registeredContentType = await hub.related.contentTypes.register(contentType);
    new data_presenter_1.default(registeredContentType.toJSON()).render({
        json: argv.json,
        tableUserConfig: table_consts_1.singleItemTableOptions
    });
};

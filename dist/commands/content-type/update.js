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
const yargs_object_transformer_1 = require("../../common/yargs/yargs-object-transformer");
const table_consts_1 = require("../../common/table/table.consts");
exports.command = 'update <id>';
exports.desc = 'Update a Content Type';
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        type: 'string',
        describe: 'content-type ID'
    })
        .options({
        label: {
            type: 'string',
            describe: 'content-type label'
        },
        icons: {
            describe: 'content-type icons'
        },
        visualizations: {
            describe: 'content-type visualizations'
        },
        cards: {
            describe: 'content-type cards'
        },
        ...data_presenter_1.RenderingOptions
    });
};
exports.handler = async (argv) => {
    const client = dynamic_content_client_factory_1.default(argv);
    const { id, label, icons, visualizations, cards } = argv;
    const contentType = await client.contentTypes.get(id);
    const mutatedContentType = new dc_management_sdk_js_1.ContentType({
        settings: {
            ...contentType.settings,
            ...(label ? { label } : {}),
            ...(icons ? { icons: yargs_object_transformer_1.transformYargObjectToArray(icons) } : {}),
            ...(cards ? { cards: yargs_object_transformer_1.transformYargObjectToArray(cards) } : {}),
            ...(visualizations
                ? {
                    visualizations: yargs_object_transformer_1.transformYargObjectToArray(visualizations)
                }
                : {})
        },
        _links: contentType._links
    });
    const updatedContentType = await contentType.related.update(mutatedContentType);
    new data_presenter_1.default(updatedContentType.toJSON()).render({
        json: argv.json,
        tableUserConfig: table_consts_1.singleItemTableOptions
    });
};

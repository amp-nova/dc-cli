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
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
exports.command = 'list';
exports.desc = 'List Content Type Schemas';
exports.builder = {
    ...data_presenter_1.RenderingOptions
};
exports.itemMapFn = ({ id, schemaId, version, validationLevel }) => ({
    ID: id,
    'Schema ID': schemaId,
    Version: version,
    'Validation Level': validationLevel
});
exports.handler = async (argv) => {
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const contentTypeSchemaList = await paginator_1.default(hub.related.contentTypeSchema.list);
    if (contentTypeSchemaList.length > 0) {
        new data_presenter_1.default(contentTypeSchemaList.map(value => value.toJSON())).render({
            json: argv.json,
            itemMapFn: exports.itemMapFn
        });
    }
    else {
        console.log('There are no content type schemas defined.');
    }
};

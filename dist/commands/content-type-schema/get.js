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
const table_consts_1 = require("../../common/table/table.consts");
exports.command = 'get <id>';
exports.desc = 'Get Content Type Schema by ID';
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        describe: 'Content Type Schema ID',
        type: 'string'
    })
        .options(data_presenter_1.RenderingOptions);
};
exports.handler = async (argv) => {
    const client = dynamic_content_client_factory_1.default(argv);
    const contentTypeSchema = await client.contentTypeSchemas.get(argv.id);
    new data_presenter_1.default(contentTypeSchema.toJSON()).render({ json: argv.json, tableUserConfig: table_consts_1.singleItemTableOptions });
};

"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const data_presenter_1 = __importStar(require("../../view/data-presenter"));
const table_consts_1 = require("../../common/table/table.consts");
const fetch_client_service_class_1 = require("../../services/fetch-client-service-class");
exports.command = 'get-search-api-key <indexId> <keyId>';
exports.desc = 'Get Search API Key';
exports.builder = (yargs) => {
    yargs
        .positional('indexId', {
        describe: 'Index ID',
        type: 'string'
    })
        .positional('keyId', {
        describe: 'Key ID',
        type: 'string'
    })
        .options(data_presenter_1.RenderingOptions);
};
exports.handler = async (argv) => {
    const fetchClient = new fetch_client_service_class_1.FetchClientService();
    await fetchClient.init(argv);
    const apiKey = await fetchClient.getSearchApiKey(argv.indexId, argv.keyId);
    new data_presenter_1.default(apiKey).render({
        json: argv.json,
        tableUserConfig: table_consts_1.singleItemTableOptions
    });
};

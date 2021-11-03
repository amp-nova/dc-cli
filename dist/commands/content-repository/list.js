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
const sorting_options_1 = require("../../common/yargs/sorting-options");
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
exports.command = 'list';
exports.desc = 'List Content Repositories';
exports.builder = {
    ...sorting_options_1.SortingOptions,
    ...data_presenter_1.RenderingOptions
};
exports.itemMapFn = ({ id, name, label, status, features, contentTypes, itemLocales }) => ({
    id,
    name,
    label,
    status,
    features: (features || []).join(', '),
    contentTypes: (contentTypes || [])
        .map((contentType) => [contentType.hubContentTypeId, contentType.contentTypeUri].join(', '))
        .join('\n'),
    itemLocales
});
exports.handler = async (argv) => {
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const contentRepositoryList = await paginator_1.default(hub.related.contentRepositories.list, sorting_options_1.extractSortable(argv));
    new data_presenter_1.default(contentRepositoryList.map(value => value.toJSON())).render({
        json: argv.json,
        itemMapFn: exports.itemMapFn
    });
};

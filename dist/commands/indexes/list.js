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
const sorting_options_1 = require("../../common/yargs/sorting-options");
const fetch_client_service_class_1 = require("../../services/fetch-client-service-class");
exports.command = 'list';
exports.desc = 'List Indexes';
exports.builder = {
    ...sorting_options_1.SortingOptions,
    ...data_presenter_1.RenderingOptions
};
exports.itemMapFn = ({ id, name, type }) => {
    return { ID: id, Name: name, Type: type };
};
exports.handler = async (argv) => {
    const fetchClient = new fetch_client_service_class_1.FetchClientService();
    await fetchClient.init(argv);
    const indexesList = await fetchClient.getIndexesList();
    new data_presenter_1.default(indexesList).render({
        json: argv.json,
        itemMapFn: exports.itemMapFn
    });
};

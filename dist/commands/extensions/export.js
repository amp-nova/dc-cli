"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const export_service_1 = require("../../services/export.service");
const path = __importStar(require("path"));
const fetch_client_service_class_1 = require("../../services/fetch-client-service-class");
exports.command = 'export <dir>';
exports.desc = 'Export Extensions';
exports.builder = (yargs) => {
    yargs.positional('dir', {
        describe: 'Output directory for the exported Extensions',
        type: 'string'
    });
};
exports.processExtensions = async (outputDir, hubToExport, extensions) => {
    const { id, name } = hubToExport;
    let dir = outputDir;
    if (outputDir.substr(-1) === path.sep) {
        dir = dir.slice(0, -1);
    }
    const file = path.basename(`extensions-${id}-${name}`, '.json');
    const uniqueFilename = dir + path.sep + file + '.json';
    if (!(await export_service_1.promptToExportSettings(uniqueFilename))) {
        return export_service_1.nothingExportedExit();
    }
    export_service_1.writeJsonToFile(uniqueFilename, extensions);
    process.stdout.write('Extensions exported successfully! \n');
};
exports.handler = async (argv) => {
    const { dir } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const fetchClient = new fetch_client_service_class_1.FetchClientService();
    await fetchClient.init(argv);
    const extensionsList = await fetchClient.getExtensionsList();
    await exports.processExtensions(dir, hub, extensionsList);
};

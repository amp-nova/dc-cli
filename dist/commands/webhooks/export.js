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
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const export_service_1 = require("../../services/export.service");
const path = __importStar(require("path"));
exports.command = 'export <dir>';
exports.desc = 'Export Webhooks';
exports.builder = (yargs) => {
    yargs
        .positional('dir', {
        describe: 'Output directory for the exported Webhooks',
        type: 'string'
    })
        .option('excludeSearch', {
        type: 'boolean',
        boolean: true,
        describe: 'Exclude search index integration webhooks.'
    })
        .alias('f', 'force')
        .option('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before exporting webhooks.'
    });
};
exports.processWebhooks = async (outputDir, hubToExport, webhooks, force) => {
    const { id, name, label } = hubToExport;
    let dir = outputDir;
    if (outputDir.substr(-1) === path.sep) {
        dir = dir.slice(0, -1);
    }
    const file = path.basename(`webhooks-${id}-${name}`, '.json');
    const uniqueFilename = dir + path.sep + file + '.json';
    if (!force) {
        if (!(await export_service_1.promptToExportSettings(uniqueFilename))) {
            return export_service_1.nothingExportedExit();
        }
    }
    export_service_1.writeJsonToFile(uniqueFilename, webhooks);
    process.stdout.write('Webhooks exported successfully! \n');
};
exports.handler = async (argv) => {
    const { dir, excludeSearch, force } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    let webhooks = await paginator_1.default(hub.related.webhooks.list);
    if (excludeSearch) {
        webhooks = webhooks.filter((item) => !item.label.startsWith('Search Index: '));
    }
    await exports.processWebhooks(dir, hub, webhooks, force);
};

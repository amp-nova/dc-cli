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
exports.desc = 'Export Indexes';
exports.builder = (yargs) => {
    yargs.positional('dir', {
        describe: 'Output directory for the exported Indexes',
        type: 'string'
    });
};
exports.processIndexes = async (outputDir, hubToExport, indexes) => {
    const { id, name } = hubToExport;
    let dir = outputDir;
    if (outputDir.substr(-1) === path.sep) {
        dir = dir.slice(0, -1);
    }
    const file = path.basename(`indexes-${id}-${name}`, '.json');
    const uniqueFilename = dir + path.sep + file + '.json';
    if (!(await export_service_1.promptToExportSettings(uniqueFilename))) {
        return export_service_1.nothingExportedExit();
    }
    export_service_1.writeJsonToFile(uniqueFilename, indexes);
    process.stdout.write('Indexes exported successfully! \n');
};
exports.handler = async (argv) => {
    const { dir } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const fetchClient = new fetch_client_service_class_1.FetchClientService();
    await fetchClient.init(argv);
    const finalIndexesListDetails = [];
    console.log(`\nRetrieve list of indexes with details:`);
    const indexesListDetails = await fetchClient.getIdexesDetailsList();
    console.log(`${indexesListDetails.map((x) => `${x.id}: ${x.name}`).join('\n')}`);
    if (indexesListDetails.length > 0) {
        console.log(`\nRetrieve all index settings:`);
        const settingsList = await Promise.all(indexesListDetails.map((item) => fetchClient.getIndexSettings(item.id)));
        console.log(`${settingsList.map((x, i) => i).join(',')}`);
        console.log(`\nRetrieve all assigned content types:`);
        const assignedContentTypesList = await Promise.all(indexesListDetails.map((item) => fetchClient.getIndexAssignedContentTypes(item.id)));
        console.log(`${assignedContentTypesList
            .map((x) => x[0] || {})
            .map((x) => x.contentTypeUri || 'none')
            .join('\n')}`);
        const activeContentWebhooks = [];
        const archivedContentWebhooks = [];
        assignedContentTypesList.forEach((types, i) => {
            if (types.length > 0) {
                const type = types[0];
                activeContentWebhooks[i] = type._links['active-content-webhook'].href.split('/').slice(-1)[0];
                archivedContentWebhooks[i] = type._links['archived-content-webhook'].href.split('/').slice(-1)[0];
            }
            else {
                activeContentWebhooks[i] = null;
                archivedContentWebhooks[i] = null;
            }
        });
        const activeContentWebhooksList = await Promise.all(activeContentWebhooks.map((item) => (item ? hub.related.webhooks.get(item) : null)));
        const archivedContentWebhooksList = await Promise.all(archivedContentWebhooks.map((item) => (item ? hub.related.webhooks.get(item) : null)));
        const activeContentWebhooksPayload = activeContentWebhooksList.map((x) => x && x.customPayload.value);
        const archivedContentWebhooksPayload = archivedContentWebhooksList.map((x) => x && x.customPayload.value);
        console.log(`\nRetrieve list of replicas:`);
        const replicas = settingsList.map((settings) => settings.replicas || []);
        console.log(`${replicas.map(x => JSON.stringify(x)).join('\n')}`);
        console.log(`\nRetrieve list of replicas details by names:`);
        const replicaIndexesList = [];
        for (let i = 0; i < replicas.length; i++) {
            console.log(`Getting replica details for: ${JSON.stringify(replicas[i])}`);
            if (replicas[i].length > 0) {
                const replicasDetailsList = await Promise.all(replicas[i].map((item) => fetchClient.getIndexByName(item)));
                replicaIndexesList.push(replicasDetailsList);
            }
            else {
                replicaIndexesList.push([]);
            }
        }
        console.log(`${replicaIndexesList.map((x) => x.map((y) => y.id || 'none')).join('\n')}`);
        const replicaIndexSettingsList = [];
        console.log(`\nRetrieve all replica index settings:`);
        for (let i = 0; i < replicaIndexesList.length; i++) {
            console.log(`Getting replica settings for: ${JSON.stringify(replicaIndexesList[i].map((x) => x.id))}`);
            if (replicaIndexesList[i].length > 0) {
                const replicasSettingsList = await Promise.all(replicaIndexesList[i].map((item) => fetchClient.getIndexSettings(item.id)));
                replicaIndexSettingsList.push(replicasSettingsList);
            }
            else {
                replicaIndexSettingsList.push([]);
            }
        }
        indexesListDetails.forEach((item, i) => {
            if (!item.parentId) {
                const replicasSettings = replicaIndexSettingsList[i].map((x, j) => ({
                    id: replicaIndexesList[i][j].id,
                    name: replicas[i][j],
                    settings: x
                }));
                const indexEntry = {
                    id: item.id,
                    indexDetails: item,
                    settings: settingsList[i],
                    replicasSettings,
                    activeContentWebhook: activeContentWebhooksPayload[i],
                    archivedContentWebhook: archivedContentWebhooksPayload[i]
                };
                if (assignedContentTypesList[i].length > 0) {
                    indexEntry.indexDetails.assignedContentTypes = assignedContentTypesList[i];
                }
                finalIndexesListDetails.push(indexEntry);
            }
        });
    }
    await exports.processIndexes(dir, hub, finalIndexesListDetails);
};

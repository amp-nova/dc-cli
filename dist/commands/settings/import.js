"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const workflowStates_mapping_1 = require("../../common/workflowStates/workflowStates-mapping");
const file_log_1 = require("../../common/file-log");
const log_helpers_1 = require("../../common/log-helpers");
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const path_1 = require("path");
const fs_1 = require("fs");
const util_1 = require("util");
const lodash_1 = require("lodash");
exports.command = 'import <filePath>';
exports.desc = 'Import Settings';
function getDefaultMappingPath(name, platform = process.platform) {
    return path_1.join(process.env[platform == 'win32' ? 'USERPROFILE' : 'HOME'] || __dirname, '.amplience', `imports/`, `${name}.json`);
}
exports.getDefaultMappingPath = getDefaultMappingPath;
const trySaveMapping = async (mapFile, mapping, log) => {
    if (mapFile != null) {
        try {
            await mapping.save(mapFile);
        }
        catch (e) {
            log.appendLine(`Failed to save the mapping. ${e.toString()}`);
        }
    }
};
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('settings', 'import', platform);
exports.builder = (yargs) => {
    yargs
        .positional('filePath', {
        describe: 'Source file path containing Settings definition',
        type: 'string'
    })
        .option('mapFile', {
        type: 'string',
        requiresArg: false,
        describe: 'Mapping file to use when updating workflow states that already exists. Updated with any new mappings that are generated. If not present, will be created.'
    })
        .option('logFile', {
        type: 'string',
        default: exports.LOG_FILENAME,
        describe: 'Path to a log file to write to.'
    })
        .alias('f', 'force')
        .option('f', {
        type: 'boolean',
        boolean: true,
        describe: 'Overwrite workflow states without asking.'
    });
};
exports.handler = async (argv) => {
    const { filePath: sourceFile, logFile, force, answer = true } = argv;
    let { mapFile } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const log = typeof logFile === 'string' || logFile == null ? new file_log_1.FileLog(logFile) : logFile;
    const mapping = new workflowStates_mapping_1.WorkflowStatesMapping();
    let uniqueLocales = [];
    let uniqueApplications = [];
    try {
        if (mapFile == null) {
            mapFile = getDefaultMappingPath(`workflow-states-${hub.id}`);
        }
        if (await mapping.load(mapFile)) {
            log.appendLine(`Existing mapping loaded from '${mapFile}', changes will be saved back to it. \n`);
        }
        else {
            log.appendLine(`Creating new mapping file at '${mapFile}'. \n`);
        }
        const exportedSettings = await util_1.promisify(fs_1.readFile)(sourceFile, { encoding: 'utf8' });
        const settingsJson = JSON.parse(exportedSettings);
        const { settings } = settingsJson;
        let { workflowStates } = settingsJson;
        if (hub.settings && hub.settings.localization && hub.settings.localization.locales) {
            uniqueLocales = lodash_1.uniq([...hub.settings.localization.locales, ...settings.localization.locales]);
        }
        if (hub.settings && hub.settings.applications) {
            uniqueApplications = lodash_1.uniqBy([...hub.settings.applications, ...settings.applications], 'name');
        }
        await hub.related.settings.update(new dc_management_sdk_js_1.Settings({
            devices: settings.devices,
            applications: uniqueApplications,
            localization: {
                locales: uniqueLocales
            }
        }));
        log.appendLine('Settings Updated! \n');
        const alreadyExists = workflowStates.filter((item) => mapping.getWorkflowState(item.id) != null);
        if (alreadyExists.length > 0) {
            const question = !force
                ? await archive_helpers_1.asyncQuestion(`${alreadyExists.length} of the workflow states being imported already exist in the mapping. Would you like to update these workflow states instead of skipping them? (y/n) `)
                : answer;
            const updateExisting = question || force;
            if (!updateExisting) {
                workflowStates = workflowStates.filter((item) => mapping.getWorkflowState(item.id) == null);
            }
        }
        await Promise.all(workflowStates.map(async (item) => {
            const exists = mapping.getWorkflowState(item.id);
            if (exists) {
                const state = await client.workflowStates.get(exists);
                await state.related.update(new dc_management_sdk_js_1.WorkflowState({
                    label: item.label,
                    color: item.color
                }));
                log.addAction('UPDATE', exists);
            }
            else {
                const newItem = await hub.related.workflowStates.create(new dc_management_sdk_js_1.WorkflowState({
                    label: item.label,
                    color: item.color
                }));
                log.addAction('CREATE', newItem.id || '');
                mapping.registerWorkflowState(item.id, newItem.id);
            }
        }));
        log.appendLine('Done!');
        await trySaveMapping(mapFile, mapping, log);
        if (log) {
            await log.close();
        }
        process.stdout.write('\n');
    }
    catch (e) {
        console.log(e);
    }
};

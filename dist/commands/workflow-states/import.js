"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const file_log_1 = require("../../common/file-log");
const log_helpers_1 = require("../../common/log-helpers");
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const fs_1 = require("fs");
const util_1 = require("util");
exports.command = 'import <filePath>';
exports.desc = 'Import Workflow States';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('workflow-states', 'import', platform);
exports.builder = (yargs) => {
    yargs
        .positional('filePath', {
        describe: 'Source file path containing Workflow States definition',
        type: 'string'
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
    const client = dynamic_content_client_factory_1.default(argv);
    const hub = await client.hubs.get(argv.hubId);
    const publishedWorkflowStatesObject = await hub.related.workflowStates.list();
    const publishedWorkflowStates = publishedWorkflowStatesObject.getItems();
    const log = typeof logFile === 'string' || logFile == null ? new file_log_1.FileLog(logFile) : logFile;
    try {
        const exportedWorkflowStates = await util_1.promisify(fs_1.readFile)(sourceFile, { encoding: 'utf8' });
        let importWorkflowStates = JSON.parse(exportedWorkflowStates);
        const publishedWorkflowStatesIDs = publishedWorkflowStates.map((x) => x.id);
        const importWorkflowStatesIDs = importWorkflowStates.map((x) => x.id);
        const alreadyExists = publishedWorkflowStatesIDs.filter(x => importWorkflowStatesIDs.includes(x));
        if (alreadyExists.length > 0) {
            const question = !force
                ? await archive_helpers_1.asyncQuestion(`${alreadyExists.length}/${importWorkflowStatesIDs.length} of the workflow states being imported already exist in the hub. Would you like to update these workflow states instead of skipping them? (y/n) `)
                : answer;
            const updateExisting = question || force;
            if (!updateExisting) {
                importWorkflowStates = importWorkflowStates.filter((item) => !publishedWorkflowStatesIDs.includes(item.id));
            }
        }
        await Promise.all(importWorkflowStates.map(async (item) => {
            const exists = publishedWorkflowStatesIDs.includes(item.id) ? item.id : undefined;
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
            }
        }));
        log.appendLine('Done!');
        if (log) {
            await log.close();
        }
        process.stdout.write('\n');
    }
    catch (e) {
        console.log(e);
    }
};

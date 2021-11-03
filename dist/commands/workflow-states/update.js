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
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const table_consts_1 = require("../../common/table/table.consts");
exports.command = 'update <id>';
exports.desc = 'Update a Workflow State';
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        type: 'string',
        describe: 'workflow-state ID'
    })
        .options({
        label: {
            type: 'string',
            describe: 'workflow-state label'
        },
        color: {
            type: 'string',
            describe: 'workflow-state color'
        },
        ...data_presenter_1.RenderingOptions
    });
};
exports.handler = async (argv) => {
    const client = dynamic_content_client_factory_1.default(argv);
    const { id, label, color } = argv;
    const workflowState = await client.workflowStates.get(id);
    const mutatedWorkflowState = new dc_management_sdk_js_1.WorkflowState({
        ...(label ? { label } : {}),
        ...(color ? { color } : {}),
        _links: workflowState._links
    });
    const updatedWorkflowState = await workflowState.related.update(mutatedWorkflowState);
    new data_presenter_1.default(updatedWorkflowState.toJSON()).render({
        json: argv.json,
        tableUserConfig: table_consts_1.singleItemTableOptions
    });
};

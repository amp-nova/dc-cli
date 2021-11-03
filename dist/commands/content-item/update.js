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
const fs_1 = require("fs");
const util_1 = require("util");
const publish_queue_1 = require("../../common/import/publish-queue");
exports.command = 'update <id> <file>';
exports.desc = 'Get Content Item';
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        describe: 'Content Item ID',
        type: 'string'
    })
        .positional('file', {
        describe: 'File with Content Item update data',
        type: 'string'
    })
        .option('publish', {
        type: 'boolean',
        boolean: true,
        describe: 'Publish content item.'
    })
        .options(data_presenter_1.RenderingOptions);
};
exports.handler = async (argv) => {
    const client = dynamic_content_client_factory_1.default(argv);
    const contentItem = await client.contentItems.get(argv.id);
    const updateContent = await util_1.promisify(fs_1.readFile)(argv.file, { encoding: 'utf8' });
    const updateJson = JSON.parse(updateContent);
    contentItem.related.update(updateJson);
    if (argv.publish) {
        const pubQueue = new publish_queue_1.PublishQueue(argv);
        await pubQueue.publish(contentItem);
    }
    new data_presenter_1.default(contentItem.toJSON()).render({
        json: argv.json,
        tableUserConfig: table_consts_1.singleItemTableOptions
    });
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const archive_log_1 = require("../../common/archive/archive-log");
const filter_1 = require("../../common/filter/filter");
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const log_helpers_1 = require("../../common/log-helpers");
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('type', 'unarchive', platform);
exports.command = 'unarchive [id]';
exports.desc = 'Unarchive Content Types';
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        type: 'string',
        describe: 'The ID of a content type to be unarchived.'
    })
        .option('schemaId', {
        type: 'string',
        describe: "The Schema ID of a Content Type's Schema to be unarchived.\nA regex can be provided to select multiple types with similar or matching schema IDs (eg /.header.\\.json/).\nA single --schemaId option may be given to match a single content type schema.\nMultiple --schemaId options may be given to match multiple content type schemas at the same time, or even multiple regex.",
        requiresArg: true
    })
        .option('revertLog', {
        type: 'string',
        describe: 'Path to a log file containing content archived in a previous run of the archive command.\nWhen provided, unarchives all content types listed as archived in the log file.',
        requiresArg: false
    })
        .alias('f', 'force')
        .option('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before unarchiving the found content.'
    })
        .alias('s', 'silent')
        .option('s', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, no log file will be produced.'
    })
        .option('ignoreError', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, unarchive requests that fail will not abort the process.'
    })
        .option('logFile', {
        type: 'string',
        default: exports.LOG_FILENAME,
        describe: 'Path to a log file to write to.'
    });
};
exports.handler = async (argv) => {
    const { id, schemaId, revertLog, ignoreError, logFile, silent, hubId, force } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    if (id != null && schemaId != null) {
        console.log('Please specify either a schema ID or an ID - not both.');
        return;
    }
    let types;
    let allContent = false;
    let missingContent = false;
    if (id != null) {
        try {
            const contentType = await client.contentTypes.get(id);
            types = [contentType];
        }
        catch (e) {
            console.log(`Fatal error: could not find content type with ID ${id}. Error: \n${e.toString()}`);
            return;
        }
    }
    else {
        try {
            const hub = await client.hubs.get(hubId);
            types = await paginator_1.default(hub.related.contentTypes.list, { status: 'ARCHIVED' });
        }
        catch (e) {
            console.log(`Fatal error: could not retrieve content types to unarchive. Is your hub correct? Error: \n${e.toString()}`);
            return;
        }
        if (revertLog != null) {
            try {
                const log = await new archive_log_1.ArchiveLog().loadFromFile(revertLog);
                const ids = log.getData('ARCHIVE');
                types = types.filter(type => ids.indexOf(type.id || '') !== -1);
                if (types.length !== ids.length) {
                    missingContent = true;
                }
            }
            catch (e) {
                console.log(`Fatal error - could not read archive log. Error: \n${e.toString()}`);
                return;
            }
        }
        else if (schemaId != null) {
            const schemaIds = Array.isArray(schemaId) ? schemaId : [schemaId];
            types = types.filter(schema => schemaIds.findIndex(id => filter_1.equalsOrRegex(schema.contentTypeUri, id)) !== -1);
        }
        else {
            allContent = true;
            console.log('No filter, ID or log file was given, so unarchiving all content.');
        }
    }
    if (types.length === 0) {
        console.log('Nothing found to unarchive, aborting.');
        return;
    }
    console.log('The following content will be unarchived:');
    types.forEach(type => {
        const settings = type.settings;
        console.log('  ' + (typeof settings === 'undefined' ? 'unknown' : settings.label));
    });
    if (!force) {
        const yes = await archive_helpers_1.confirmArchive('unarchive', 'content types', allContent, missingContent);
        if (!yes) {
            return;
        }
    }
    const timestamp = Date.now().toString();
    const log = new archive_log_1.ArchiveLog(`Content Type Unarchive Log - ${timestamp}\n`);
    let successCount = 0;
    for (let i = 0; i < types.length; i++) {
        const settings = types[i].settings;
        const label = settings === undefined ? 'unknown' : settings.label;
        try {
            await types[i].related.unarchive();
            log.addAction('UNARCHIVE', types[i].id || 'unknown');
            successCount++;
        }
        catch (e) {
            log.addComment(`UNARCHIVE FAILED: ${types[i].id}`);
            log.addComment(e.toString());
            if (ignoreError) {
                console.log(`Failed to unarchive ${label}, continuing. Error: \n${e.toString()}`);
            }
            else {
                console.log(`Failed to unarchive ${label}, aborting. Error: \n${e.toString()}`);
                break;
            }
        }
        console.log('Unarchived: ' + label);
    }
    if (!silent && logFile) {
        await log.writeToFile(logFile.replace('<DATE>', timestamp));
    }
    console.log(`Unarchived ${successCount} content types.`);
};

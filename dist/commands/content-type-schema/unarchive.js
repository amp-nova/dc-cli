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
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('schema', 'unarchive', platform);
exports.command = 'unarchive [id]';
exports.desc = 'Unarchive Content Type Schemas';
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        type: 'string',
        describe: 'The ID of a schema to be unarchived. Note that this is different from the schema ID - which is in a URL format.'
    })
        .option('schemaId', {
        type: 'string',
        describe: 'The Schema ID of a Content Type Schema to be unarchived.\nA regex can be provided to \nA single --schemaId option may be given to unarchive a single content type schema.\nMultiple --schemaId options may be given to unarchive multiple content type schemas at the same time.',
        requiresArg: true
    })
        .option('revertLog', {
        type: 'string',
        describe: 'Path to a log file containing content archived in a previous run of the archive command.\nWhen provided, unarchives all schemas listed as archived in the log file.',
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
    const { id, schemaId, revertLog, ignoreError, logFile, silent, force } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    if (id != null && schemaId != null) {
        console.log('Please specify either a schema ID or an ID - not both.');
        return;
    }
    let schemas = [];
    let allContent = false;
    let missingContent = false;
    if (id != null) {
        try {
            const contentTypeSchema = await client.contentTypeSchemas.get(id);
            schemas = [contentTypeSchema];
        }
        catch (e) {
            console.log(`Fatal error: could not find content type schema with ID ${id}. Error: \n${e.toString()}`);
            return;
        }
    }
    else {
        try {
            const hub = await client.hubs.get(argv.hubId);
            schemas = await paginator_1.default(hub.related.contentTypeSchema.list, { status: 'ARCHIVED' });
        }
        catch (e) {
            console.log(`Fatal error: could not retrieve content type schemas to unarchive. Is your hub correct? Error: \n${e.toString()}`);
            return;
        }
        if (revertLog != null) {
            try {
                const log = await new archive_log_1.ArchiveLog().loadFromFile(revertLog);
                const ids = log.getData('ARCHIVE');
                schemas = schemas.filter(schema => ids.indexOf(schema.schemaId) !== -1);
                if (schemas.length !== ids.length) {
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
            schemas = schemas.filter(schema => schemaIds.findIndex(id => filter_1.equalsOrRegex(schema.schemaId, id)) !== -1);
        }
        else {
            allContent = true;
            console.log('No filter, ID or log file was given, so unarchiving all content.');
        }
    }
    if (schemas.length === 0) {
        console.log('Nothing found to unarchive, aborting.');
        return;
    }
    console.log('The following content will be unarchived:');
    schemas.forEach(schema => {
        console.log('  ' + schema.schemaId);
    });
    if (!force) {
        const yes = await archive_helpers_1.confirmArchive('unarchive', 'content type schema', allContent, missingContent);
        if (!yes) {
            return;
        }
    }
    const timestamp = Date.now().toString();
    const log = new archive_log_1.ArchiveLog(`Content Type Schema Unarchive Log - ${timestamp}\n`);
    let successCount = 0;
    for (let i = 0; i < schemas.length; i++) {
        try {
            await schemas[i].related.unarchive();
            log.addAction('UNARCHIVE', schemas[i].schemaId);
            successCount++;
        }
        catch (e) {
            log.addComment(`UNARCHIVE FAILED: ${schemas[i].schemaId}`);
            log.addComment(e.toString());
            if (ignoreError) {
                console.log(`Failed to unarchive ${schemas[i].schemaId}, continuing. Error: \n${e.toString()}`);
            }
            else {
                console.log(`Failed to unarchive ${schemas[i].schemaId}, aborting. Error: \n${e.toString()}`);
                break;
            }
        }
        console.log('Unarchived: ' + schemas[i].schemaId);
    }
    if (!silent && logFile) {
        await log.writeToFile(logFile.replace('<DATE>', timestamp));
    }
    console.log(`Unarchived ${successCount} content type schemas.`);
};

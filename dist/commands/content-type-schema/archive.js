"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const archive_log_1 = require("../../common/archive/archive-log");
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const filter_1 = require("../../common/filter/filter");
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const log_helpers_1 = require("../../common/log-helpers");
exports.command = 'archive [id]';
exports.desc = 'Archive Content Type Schemas';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('schema', 'archive', platform);
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        type: 'string',
        describe: 'The ID of a schema to be archived. Note that this is different from the schema ID - which is in a URL format. If neither this or schemaId are provided, this command will archive ALL content type schemas in the hub.'
    })
        .option('schemaId', {
        type: 'string',
        describe: 'The Schema ID of a Content Type Schema to be archived.\nA regex can be provided to select multiple schemas with similar IDs (eg /.header.\\.json/).\nA single --schemaId option may be given to archive a single content type schema.\nMultiple --schemaId options may be given to archive multiple content type schemas at the same time, or even multiple regex.'
    })
        .option('revertLog', {
        type: 'string',
        describe: 'Path to a log file containing content unarchived in a previous run of the unarchive command.\nWhen provided, archives all schemas listed as unarchived in the log file.',
        requiresArg: false
    })
        .alias('f', 'force')
        .option('f', {
        type: 'boolean',
        boolean: true,
        describe: 'If present, there will be no confirmation prompt before archiving the found content.'
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
        describe: 'If present, archive requests that fail will not abort the process.'
    })
        .option('logFile', {
        type: 'string',
        default: exports.LOG_FILENAME,
        describe: 'Path to a log file to write to.'
    });
};
exports.handler = async (argv) => {
    const { id, logFile, force, silent, ignoreError, hubId, revertLog, schemaId } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    if (id != null && schemaId != null) {
        console.log('Please specify either a schema ID or an ID - not both.');
        return;
    }
    let schemas;
    let allContent = false;
    let missingContent = false;
    if (id != null) {
        try {
            const contentTypeSchema = await client.contentTypeSchemas.get(id);
            schemas = [contentTypeSchema];
        }
        catch (e) {
            console.log(`Fatal error: could not find schema with ID ${id}. Error: \n${e.toString()}`);
            return;
        }
    }
    else {
        try {
            const hub = await client.hubs.get(hubId);
            schemas = await paginator_1.default(hub.related.contentTypeSchema.list, { status: 'ACTIVE' });
        }
        catch (e) {
            console.log(`Fatal error: could not retrieve content type schemas to archive. Is your hub correct? Error: \n${e.toString()}`);
            return;
        }
        if (revertLog != null) {
            try {
                const log = await new archive_log_1.ArchiveLog().loadFromFile(revertLog);
                const ids = log.getData('UNARCHIVE');
                schemas = schemas.filter(schema => ids.indexOf(schema.schemaId) !== -1);
                if (schemas.length !== ids.length) {
                    missingContent = true;
                }
            }
            catch (e) {
                console.log(`Fatal error - could not read unarchive log. Error: \n${e.toString()}`);
                return;
            }
        }
        else if (schemaId != null) {
            const schemaIdArray = Array.isArray(schemaId) ? schemaId : [schemaId];
            schemas = schemas.filter(schema => schemaIdArray.findIndex(id => filter_1.equalsOrRegex(schema.schemaId, id)) !== -1);
        }
        else {
            console.log('No filter, ID or log file was given, so archiving all content.');
            allContent = true;
        }
    }
    if (schemas.length === 0) {
        console.log('Nothing found to archive, aborting.');
        return;
    }
    console.log('The following content will be archived:');
    schemas.forEach(schema => {
        console.log('  ' + schema.schemaId);
    });
    if (!force) {
        const yes = await archive_helpers_1.confirmArchive('archive', 'content type schema', allContent, missingContent);
        if (!yes) {
            return;
        }
    }
    const timestamp = Date.now().toString();
    const log = new archive_log_1.ArchiveLog(`Content Type Schema Archive Log - ${timestamp}\n`);
    let successCount = 0;
    for (let i = 0; i < schemas.length; i++) {
        try {
            await schemas[i].related.archive();
            log.addAction('ARCHIVE', `${schemas[i].schemaId}\n`);
            successCount++;
        }
        catch (e) {
            log.addComment(`ARCHIVE FAILED: ${schemas[i].schemaId}`);
            log.addComment(e.toString());
            if (ignoreError) {
                console.log(`Failed to archive ${schemas[i].schemaId}, continuing. Error: \n${e.toString()}`);
            }
            else {
                console.log(`Failed to archive ${schemas[i].schemaId}, aborting. Error: \n${e.toString()}`);
                break;
            }
        }
    }
    if (!silent && logFile) {
        await log.writeToFile(logFile.replace('<DATE>', timestamp));
    }
    console.log(`Archived ${successCount} content type schemas.`);
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const archive_log_1 = require("../../common/archive/archive-log");
const paginator_1 = __importDefault(require("../../common/dc-management-sdk-js/paginator"));
const archive_helpers_1 = require("../../common/archive/archive-helpers");
const filter_1 = require("../../common/filter/filter");
const log_helpers_1 = require("../../common/log-helpers");
const maxAttempts = 30;
exports.command = 'archive [id]';
exports.desc = 'Archive Events';
exports.LOG_FILENAME = (platform = process.platform) => log_helpers_1.getDefaultLogPath('event', 'archive', platform);
exports.builder = (yargs) => {
    yargs
        .positional('id', {
        type: 'string',
        describe: 'The ID of an Event to be archived. If id is not provided, this command will not archive something.'
    })
        .option('name', {
        type: 'string',
        describe: 'The name of an Event to be archived.\nA regex can be provided to select multiple items with similar or matching names (eg /.header/).\nA single --name option may be given to match a single event pattern.\nMultiple --name options may be given to match multiple events patterns at the same time, or even multiple regex.'
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
        .option('logFile', {
        type: 'string',
        default: exports.LOG_FILENAME,
        describe: 'Path to a log file to write to.'
    });
};
const getEventUntilSuccess = async ({ id = '', resource = 'archive', client }) => {
    let resourceEvent;
    for (let i = 0; i < maxAttempts; i++) {
        const event = await client.events.get(id);
        const link = event._links && event._links[resource];
        if (link) {
            resourceEvent = event;
            break;
        }
    }
    return resourceEvent;
};
exports.getEvents = async ({ id, client, hubId, name }) => {
    try {
        if (id != null) {
            const event = await client.events.get(id);
            const editions = await paginator_1.default(event.related.editions.list);
            return [
                {
                    event,
                    editions,
                    command: 'ARCHIVE',
                    unscheduleEditions: [],
                    deleteEditions: [],
                    archiveEditions: []
                }
            ];
        }
        const hub = await client.hubs.get(hubId);
        const eventsList = await paginator_1.default(hub.related.events.list);
        let events = eventsList;
        if (name != null) {
            const itemsArray = Array.isArray(name) ? name : [name];
            events = eventsList.filter(({ name: eventName }) => itemsArray.findIndex(id => {
                return filter_1.equalsOrRegex(eventName || '', id);
            }) != -1);
        }
        return await Promise.all(events.map(async (event) => ({
            event,
            editions: await paginator_1.default(event.related.editions.list),
            command: 'ARCHIVE',
            unscheduleEditions: [],
            deleteEditions: [],
            archiveEditions: []
        })));
    }
    catch (e) {
        console.log(e);
        return [];
    }
};
exports.processItems = async ({ client, events, force, silent, missingContent, logFile }) => {
    try {
        for (let i = 0; i < events.length; i++) {
            events[i].deleteEditions = events[i].editions.filter(({ publishingStatus }) => publishingStatus === 'DRAFT' || publishingStatus === 'UNSCHEDULING');
            events[i].unscheduleEditions = events[i].editions.filter(({ publishingStatus }) => publishingStatus === 'SCHEDULED' || publishingStatus === 'SCHEDULING');
            events[i].archiveEditions = events[i].editions.filter(({ publishingStatus }) => publishingStatus === 'PUBLISHED' || publishingStatus === 'PUBLISHING');
            if (events[i].deleteEditions.length + events[i].unscheduleEditions.length === events[i].editions.length) {
                events[i].command = 'DELETE';
            }
        }
        console.log('The following events are processing:');
        events.forEach(({ event, command = '', deleteEditions, unscheduleEditions, archiveEditions }) => {
            console.log(`${command}: ${event.name} (${event.id})`);
            if (deleteEditions.length || unscheduleEditions.length) {
                console.log(' Editions:');
                deleteEditions.forEach(({ name, id }) => {
                    console.log(`   DELETE: ${name} (${id})`);
                });
                archiveEditions.forEach(({ name, id }) => {
                    console.log(`   ARCHIVE: ${name} (${id})`);
                });
                unscheduleEditions.forEach(({ name, id }) => {
                    console.log(`   UNSCHEDULE: ${name} (${id})`);
                });
            }
        });
        console.log(`Total: ${events.length}`);
        if (!force) {
            const yes = await archive_helpers_1.confirmArchive('perform', 'actions', false, missingContent);
            if (!yes) {
                return;
            }
        }
        const timestamp = Date.now().toString();
        const log = new archive_log_1.ArchiveLog(`Events Archive Log - ${timestamp}\n`);
        let successCount = 0;
        for (let i = 0; i < events.length; i++) {
            try {
                await Promise.all(events[i].unscheduleEditions.map(edition => edition.related.unschedule()));
                if (events[i].command === 'ARCHIVE') {
                    await Promise.all(events[i].deleteEditions.map(edition => edition.related.delete()));
                    await Promise.all(events[i].archiveEditions.map(edition => edition.related.archive()));
                }
                const resource = await getEventUntilSuccess({
                    id: events[i].event.id || '',
                    resource: events[i].command.toLowerCase(),
                    client
                });
                if (!resource) {
                    log.addComment(`${events[i].command} FAILED: ${events[i].event.id}`);
                    log.addComment(`You don't have access to perform this action, try again later or contact support.`);
                }
                if (events[i].command === 'DELETE') {
                    resource && (await resource.related.delete());
                    log.addAction(events[i].command, `${events[i].event.id}\n`);
                    successCount++;
                }
                else {
                    resource && (await resource.related.archive());
                    log.addAction(events[i].command, `${events[i].event.id}\n`);
                    successCount++;
                }
            }
            catch (e) {
                console.log(e);
                log.addComment(`${events[i].command} FAILED: ${events[i].event.id}`);
                log.addComment(e.toString());
            }
        }
        if (!silent && logFile) {
            await log.writeToFile(logFile.replace('<DATE>', timestamp));
        }
        return console.log(`Processed ${successCount} events.`);
    }
    catch (e) {
        return;
    }
};
exports.handler = async (argv) => {
    const { id, logFile, force, silent, name, hubId } = argv;
    const client = dynamic_content_client_factory_1.default(argv);
    const missingContent = false;
    if (name && id) {
        console.log('ID of event is specified, ignoring name');
    }
    if (!name && !id) {
        console.log('No ID or name is specified');
        return;
    }
    const events = await exports.getEvents({
        id,
        client,
        hubId,
        name
    });
    if (events.length == 0) {
        console.log('Nothing found to archive, aborting.');
        return;
    }
    await exports.processItems({
        client,
        events,
        missingContent,
        logFile,
        force,
        silent
    });
};

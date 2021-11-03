"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const file_log_1 = require("../../common/file-log");
const dynamic_content_client_factory_1 = __importDefault(require("../../services/dynamic-content-client-factory"));
const archive_helpers_1 = require("../../common/archive/archive-helpers");
exports.revert = async (argv) => {
    const log = new file_log_1.FileLog();
    try {
        await log.loadFromFile(argv.revertLog);
    }
    catch (e) {
        console.log('Could not open the import log! Aborting.');
        return false;
    }
    const client = dynamic_content_client_factory_1.default(argv);
    const toArchive = log.getData('CREATE');
    const toDowngrade = log.getData('UPDATE');
    const items = [];
    for (let i = 0; i < toArchive.length; i++) {
        const id = toArchive[i];
        try {
            const item = await client.contentItems.get(id);
            items.push({ item, oldVersion: 0, newVersion: 1 });
        }
        catch (_a) {
            console.log(`Could not find item with id ${id}, skipping.`);
        }
    }
    let unchanged = 0;
    for (let i = 0; i < toDowngrade.length; i++) {
        const split = toDowngrade[i].split(' ');
        if (split.length !== 3) {
            continue;
        }
        const id = split[0];
        const oldVersion = Number(split[1]);
        const newVersion = Number(split[2]);
        if (oldVersion === newVersion) {
            unchanged++;
            continue;
        }
        try {
            const item = await client.contentItems.get(id);
            items.push({ item, oldVersion, newVersion });
        }
        catch (_b) {
            console.log(`Could not find item with id ${id}, skipping.`);
        }
    }
    if (unchanged > 0) {
        console.log(`${unchanged} content items were imported, but were not updated so there is nothing to revert. Ignoring.`);
    }
    const changed = items.filter(entry => entry.item.version !== entry.newVersion);
    if (changed.length > 0) {
        console.log(`${changed.length} content items have been changed since they were imported:`);
        changed.forEach(entry => {
            const hasBeenArchived = entry.item.status !== 'ACTIVE' ? ', has been archived)' : '';
            const summary = `(modified ${entry.item.version -
                entry.newVersion} times since import${hasBeenArchived})`;
            console.log(`  ${entry.item.label} ${summary}`);
        });
        const answer = await archive_helpers_1.asyncQuestion('Do you want to continue with the revert, losing any changes made since the import? (y/n)\n');
        if (!answer) {
            return false;
        }
    }
    if (items.length > 0) {
        for (let i = 0; i < items.length; i++) {
            const entry = items[i];
            const item = entry.item;
            if (entry.oldVersion === 0) {
                if (item.status === 'ACTIVE') {
                    console.log(`Archiving ${item.label}.`);
                    try {
                        await item.related.archive();
                    }
                    catch (e) {
                        console.log(`Could not archive ${item.label}!\n${e.toString()}\nContinuing...`);
                    }
                }
            }
            else {
                let oldItem;
                try {
                    oldItem = await item.related.contentItemVersion(entry.oldVersion);
                }
                catch (e) {
                    console.log(`Could not get old version for ${item.label}!\n${e.toString()}\nContinuing...`);
                    continue;
                }
                console.log(`Reverting ${item.label} to version ${entry.oldVersion}.`);
                try {
                    await item.related.update(oldItem);
                }
                catch (e) {
                    console.log(`Could not revert ${item.label}!\n${e.toString()}\nContinuing...`);
                }
            }
        }
    }
    else {
        console.log('No actions found to revert.');
    }
    console.log('Done!');
    return true;
};

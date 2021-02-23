import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ImportSettingsBuilderOptions } from '../../interfaces/import-settings-builder-options.interface';
import { FileLog } from '../../common/file-log';
import { getDefaultLogPath } from '../../common/log-helpers';
import { asyncQuestion } from '../../common/archive/archive-helpers';
import { readFile } from 'fs';
import { promisify } from 'util';
import { FetchClientService, IndexEntry } from '../../services/fetch-client-service-class';
import { Hub } from 'dc-management-sdk-js';

export type Answer = {
  answer?: string[];
};

export const command = 'import <filePath>';

export const desc = 'Import Indexes';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('indexes', 'import', platform);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const builder = (yargs: Argv): void => {
  yargs
    .positional('filePath', {
      describe: 'Source file path containing Indexes definition',
      type: 'string'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite indexes without asking.'
    });
};

export const handler = async (
  argv: Arguments<ImportSettingsBuilderOptions & ConfigurationParameters & Answer>
): Promise<void> => {
  const { filePath: sourceFile, logFile, force, answer = true } = argv;
  const fetchClient = new FetchClientService();
  await fetchClient.init(argv);

  const publishedIndexes = await fetchClient.getIndexesList();

  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;

  try {
    const exportedIndexes = await promisify(readFile)(sourceFile, { encoding: 'utf8' });
    let importIndexes = JSON.parse(exportedIndexes);

    // Retrieve list of published Indexes for comparison
    const publishedIndexesIDs = publishedIndexes.map((x: any) => x.id);
    const importIndexesIDs = importIndexes.map((x: any) => x.id);
    const alreadyExists = publishedIndexesIDs.filter((x: any) => importIndexesIDs.includes(x));

    if (alreadyExists.length > 0) {
      const question = !force
        ? await asyncQuestion(
            `${alreadyExists.length}/${importIndexesIDs.length} of the indexes being imported already exist in the hub. Would you like to re-create these indexes instead of skipping them? (y/n) `
          )
        : answer;

      const updateExisting = question || force;

      // Filter out existing indexes
      if (!updateExisting) {
        importIndexes = importIndexes.filter((item: any) => !publishedIndexesIDs.includes(item.id));
      }
    }
    await Promise.all(
      importIndexes.map(async (item: IndexEntry) => {
        const exists = publishedIndexesIDs.includes(item.id) ? item.id : undefined;

        if (exists) {
          // Delete index and replicas
          console.log(`Deleting index and replicas: ${exists}`);
          const deletedIndexIds = await fetchClient.deleteIndexAndReplicas(exists);
          console.log(`...Index and replicas deleted for IDs: ${deletedIndexIds}`);
          console.log();
          log.addAction('DELETE INDEX', deletedIndexIds.join(','));
          // await asyncQuestion("");
        }

        // Remove ID and replica count for creation
        delete item.indexDetails.id;
        delete item.indexDetails.replicaCount;

        // Create index
        console.log(`Creating index for index name: ${item.indexDetails.name}`);
        const createdIndexId = await fetchClient.createIndex(item.indexDetails);
        console.log(`...Index created with ID: ${createdIndexId}`);
        log.addAction('CREATE INDEX', createdIndexId || '');
        // await asyncQuestion("");

        // Update index settings
        console.log(`\nUpdating index settings for ID: ${createdIndexId}`);
        const updatedIndexId = await fetchClient.updateIndexSettings(createdIndexId, item.settings);
        console.log(`...Index settings updated for ID: ${updatedIndexId}`);
        log.addAction('UPDATE INDEX SETTINGS', updatedIndexId || '');
        // await asyncQuestion("");
        await sleep(3000);

        // Get list of replicas settings
        const replicasSettings: any[] = item.replicasSettings;

        // Get list of replicas indexes by name
        console.log(
          `\nGetting replica index details from names: ${replicasSettings.map((x: any) => x.name).join(',')}`
        );
        const replicasIndexes = await Promise.all(
          replicasSettings.map((item: any) => fetchClient.getIndexByName(item.name))
        );
        console.log(`...Retrieved replica index details for IDs: ${replicasIndexes.map((x: any) => x.id).join(',')}`);

        // Update replicas settings
        console.log(`\nUpdating replicas settings for IDs: ${replicasIndexes.map((x: any) => x.id).join(',')}`);
        const updatedReplicasSettingsIds = await Promise.all(
          replicasIndexes.map((item: any, i: number) =>
            fetchClient.updateIndexSettings(item.id, replicasSettings[i].settings)
          )
        );
        console.log(`...Updated replicas settings for IDs: ${updatedReplicasSettingsIds.join(',')}`);
        console.log();
        log.addAction('UPDATE INDEX SETTINGS', updatedReplicasSettingsIds.join(',') || '');

        // Get assigned type
        const types: any[] = await fetchClient.getIndexAssignedContentTypes(createdIndexId);

        // Get active and archive webhooks
        if (types.length > 0) {
          const type = types[0];
          const activeContentWebhookId = type._links['active-content-webhook'].href.split('/').slice(-1)[0];
          const archivedContentWebhookId = type._links['archived-content-webhook'].href.split('/').slice(-1)[0];

          // Update webhooks payload
          console.log(`Updating webhooks ${activeContentWebhookId}, ${archivedContentWebhookId}`);
          await Promise.all([
            fetchClient.updateWebhook(activeContentWebhookId, {
              customPayload: {
                type: 'text/x-handlebars-template',
                value: item.activeContentWebhook
              }
            }),
            fetchClient.updateWebhook(archivedContentWebhookId, {
              customPayload: {
                type: 'text/x-handlebars-template',
                value: item.archivedContentWebhook
              }
            })
          ]);
        }
      })
    );

    log.appendLine('Done!');

    if (log) {
      await log.close();
    }

    process.stdout.write('\n');
  } catch (e) {
    console.log(e);
  }
};

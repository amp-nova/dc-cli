import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { Webhook } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ImportSettingsBuilderOptions } from '../../interfaces/import-settings-builder-options.interface';
import { FileLog } from '../../common/file-log';
import { getDefaultLogPath } from '../../common/log-helpers';
import { asyncQuestion } from '../../common/archive/archive-helpers';
import { readFile } from 'fs';
import { promisify } from 'util';

export type Answer = {
  answer?: string[];
};

export const command = 'import <filePath>';

export const desc = 'Import Webhooks';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('webhooks', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('filePath', {
      describe: 'Source file path containing Webhooks definition',
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
      describe: 'Overwrite webhooks without asking.'
    });
};

export const handler = async (
  argv: Arguments<ImportSettingsBuilderOptions & ConfigurationParameters & Answer>
): Promise<void> => {
  const { filePath: sourceFile, logFile, force, answer = true } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const publishedWebhooksObject = await hub.related.webhooks.list();
  const publishedWebhooks = publishedWebhooksObject.getItems();

  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;

  try {
    const exportedWebhooks = await promisify(readFile)(sourceFile, { encoding: 'utf8' });
    let importWebhooks = JSON.parse(exportedWebhooks);

    // Retrieve list of published Webhooks for comparison
    const publishedWebhooksIDs = publishedWebhooks.map((x: Webhook) => x.id);
    const importWebhooksIDs = importWebhooks.map((x: Webhook) => x.id);
    const alreadyExists = publishedWebhooksIDs.filter(x => importWebhooksIDs.includes(x));

    if (alreadyExists.length > 0) {
      const question = !force
        ? await asyncQuestion(
            `${alreadyExists.length}/${importWebhooksIDs.length} of the webhooks being imported already exist in the hub. Would you like to re-create these webhooks instead of skipping them? (y/n) `
          )
        : answer;

      const updateExisting = question || force;

      if (!updateExisting) {
        importWebhooks = importWebhooks.filter((item: Webhook) => !publishedWebhooksIDs.includes(item.id));
      }
    }
    await Promise.all(
      importWebhooks.map(async (item: Webhook) => {
        const exists = publishedWebhooksIDs.includes(item.id) ? item.id : undefined;

        if (exists) {
          const hub = await client.hubs.get(argv.hubId);
          const webhook = await hub.related.webhooks.get(exists);

          await webhook.related.delete();
          log.addAction('DELETE', exists);
        }

        // Remove ID and Secret for creation
        item.id = undefined;
        item.secret = undefined;
        const newItem = await hub.related.webhooks.create(new Webhook(item));
        log.addAction('CREATE', newItem.id || '');
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

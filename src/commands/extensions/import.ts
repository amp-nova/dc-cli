import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { ImportSettingsBuilderOptions } from '../../interfaces/import-settings-builder-options.interface';
import { FileLog } from '../../common/file-log';
import { getDefaultLogPath } from '../../common/log-helpers';
import { asyncQuestion } from '../../common/archive/archive-helpers';
import { readFile } from 'fs';
import { promisify } from 'util';
import { FetchClientService } from '../../services/fetch-client-service-class';

export type Answer = {
  answer?: string[];
};

export const command = 'import <filePath>';

export const desc = 'Import Extensions';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('extensions', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('filePath', {
      describe: 'Source file path containing Extensions definition',
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
      describe: 'Overwrite extensions without asking.'
    });
};

export const handler = async (
  argv: Arguments<ImportSettingsBuilderOptions & ConfigurationParameters & Answer>
): Promise<void> => {
  const { filePath: sourceFile, logFile, force, answer = true } = argv;
  const fetchClient = new FetchClientService();
  await fetchClient.init(argv);
  const publishedExtensions = await fetchClient.getExtensionsList();
    
  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;

  try {
    const exportedExtensions = await promisify(readFile)(sourceFile, { encoding: 'utf8' });
    let importExtensions = JSON.parse(exportedExtensions);

    // Retrieve list of published Extensions for ID comparison
    const publishedExtensionsIDs = publishedExtensions.map((x: any) => x.id);
    const importExtensionsIDs = importExtensions.map((x: any) => x.id);
    const alreadyExists = publishedExtensionsIDs.filter((x: any) => importExtensionsIDs.includes(x));
    
    if (alreadyExists.length > 0) {
      const question = !force
        ? await asyncQuestion(
            `${alreadyExists.length}/${importExtensionsIDs.length} of the extensions being imported already exist in the hub. Would you like to update these extensions instead of skipping them? (y/n) `
          )
        : answer;

      const updateExisting = question || force;

      if (!updateExisting) {
        importExtensions = importExtensions.filter((item: any) => !publishedExtensionsIDs.includes(item.id));
      }
    }
    await Promise.all(
      importExtensions.map(async (item: any) => {
        let exists = publishedExtensionsIDs.includes(item.id) ? item.id : undefined;

        // If no existing ID found, check by extension name
        if (!exists) {
          console.log(`Checking existence by extension name: ${item.name}`);
          const extension = await fetchClient.getExtensionByName(item.name);
          if (extension) exists = extension.id;
        }

        if (exists) {

          // Remove hubId and Secret for update
          delete item.hubId;
          delete item.secret;

          // Update extension instead of deleting it as it's only a soft delete
          const updatedExtensionId = await fetchClient.updateExtension(exists, item);
          log.addAction('UDPATE', updatedExtensionId || '');
        } else {

          // Remove ID, hubId and Secret for creation
          delete item.id;
          delete item.hubId;
          delete item.secret;

          // Create extension
          const createdExtensionId = await fetchClient.createExtension(item);
          log.addAction('CREATE', createdExtensionId || '');
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
